// Rates of one device from /proc/net/dev; "auto" follows the default route, as in netload.
import GLib from 'gi://GLib';

import {readText, readTextOrNull} from '../procfs.js';

export const AUTO_DEVICE = 'auto';

// IFF_UP from <linux/if.h>: administratively up. XFCE reads the same flag with an ioctl.
const IFF_UP = 0x1;

/**
 * After two header lines: "name: rx_bytes ... (8 rx fields) tx_bytes ...".
 *
 * @param {string} text - /proc/net/dev
 * @returns {Map<string, {rxBytes: number, txBytes: number}>}
 */
export function parseNetDev(text) {
    const devices = new Map();
    for (const line of text.split('\n').slice(2)) {
        const colon = line.indexOf(':');
        if (colon < 0)
            continue;
        const fields = line.slice(colon + 1).trim().split(/\s+/).map(Number);
        if (fields.length < 9)
            continue;
        devices.set(line.slice(0, colon).trim(), {rxBytes: fields[0], txBytes: fields[8]});
    }
    return devices;
}

/**
 * The IPv4 default route with the lowest metric (netload's find_default_route_device()).
 * XFCE: takes any zero destination, also a VPN's 0.0.0.0/1 and device-less "*" routes.
 * IPv6-only routes aren't seen, as in netload; /proc/net/ipv6_route would add them.
 *
 * @param {string} text - /proc/net/route
 * @returns {string|null}
 */
export function parseDefaultRoute(text) {
    let best = null;
    let bestMetric = Infinity;
    // Iface Destination Gateway Flags RefCnt Use Metric Mask MTU Window IRTT
    for (const line of text.split('\n').slice(1)) {
        const [iface, destination, , , , , metric, mask] = line.trim().split(/\s+/);
        if (!iface || iface === '*' || Number.parseInt(destination, 16) !== 0 ||
            Number.parseInt(mask, 16) !== 0)
            continue;
        if (Number(metric) < bestMetric) {
            bestMetric = Number(metric);
            best = iface;
        }
    }
    return best;
}

/**
 * The name comes from settings and becomes part of a /sys path.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isValidDeviceName(name) {
    return /^[^/\s:]{1,15}$/.test(name) && name !== '.' && name !== '..';
}

async function readDeviceUp(name, cancellable) {
    const flags = await readTextOrNull(`/sys/class/net/${name}/flags`, cancellable);
    return flags !== null && (Number.parseInt(flags, 16) & IFF_UP) !== 0;
}

/**
 * A counter that went down (device re-created) counts from zero, as in netload.
 *
 * @param {number} prev
 * @param {number} cur
 * @param {number} seconds
 * @returns {number} bytes/s
 */
export function rate(prev, cur, seconds) {
    return (cur >= prev ? cur - prev : cur) / seconds;
}

// A new device primes again; totals carry on, as in netload.
export class NetworkSource {
    #configured;
    #device = null;
    #prev = null;
    #total = {rx: 0, tx: 0};

    constructor(configured) {
        this.#configured = configured || AUTO_DEVICE;
    }

    // {device, up, rx, tx, rxTotal, txTotal}; no rates on a priming sample, no device yet in
    // auto mode without a route.
    async read(cancellable) {
        const auto = this.#configured === AUTO_DEVICE;
        const [route, netDev] = await Promise.all([
            auto ? readText('/proc/net/route', cancellable) : null,
            readText('/proc/net/dev', cancellable),
        ]);
        // Without a default route auto mode stays on the last device, as netload does.
        const device = auto ? parseDefaultRoute(route) ?? this.#device : this.#configured;

        if (device !== this.#device) {
            this.#device = device;
            this.#prev = null;
        }
        if (!device || !isValidDeviceName(device) || !await readDeviceUp(device, cancellable))
            return {device, up: false};

        const counters = parseNetDev(netDev).get(device);
        if (!counters)
            return {device, up: false};
        return {device, up: true, ...this.update(counters, GLib.get_monotonic_time())};
    }

    // Apart from read() for the tests. XFCE: totals are rate * interval; here exact deltas.
    update(counters, timeUs) {
        const prev = this.#prev;
        this.#prev = {...counters, timeUs};
        const seconds = prev ? (timeUs - prev.timeUs) / 1e6 : 0;
        if (seconds <= 0)
            return {};

        const rx = rate(prev.rxBytes, counters.rxBytes, seconds);
        const tx = rate(prev.txBytes, counters.txBytes, seconds);
        this.#total.rx += rx * seconds;
        this.#total.tx += tx * seconds;
        return {rx, tx, rxTotal: this.#total.rx, txTotal: this.#total.tx};
    }
}

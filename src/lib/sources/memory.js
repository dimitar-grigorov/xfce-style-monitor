// Memory and swap from /proc/meminfo, in bytes. Used = total - available, as in XFCE.
import {readText} from '../procfs.js';

/**
 * @param {string} text - /proc/meminfo
 * @returns {Object<string, number>} every "Key: value [kB]" line, in bytes
 */
export function parseMeminfo(text) {
    const fields = {};
    for (const [, key, value, unit] of text.matchAll(/^([\w()]+):\s+(\d+)(?: (kB))?$/gm))
        fields[key] = Number(value) * (unit ? 1024 : 1);
    return fields;
}

/**
 * Kernels before 3.14 have no MemAvailable: free + buffers + cached, as XFCE falls back.
 *
 * @param {Object<string, number>} fields - from parseMeminfo()
 * @returns {{memTotal: number, memUsed: number, swapTotal: number, swapUsed: number,
 *   fields: Object<string, number>}|null}
 */
export function memoryUsage(fields) {
    const {MemTotal, MemFree, MemAvailable, Buffers = 0, Cached = 0, SwapTotal = 0, SwapFree = 0} =
        fields;
    if (!MemTotal || MemFree === undefined)
        return null;

    const available = MemAvailable ?? MemFree + Buffers + Cached;
    return {
        memTotal: MemTotal,
        memUsed: Math.max(MemTotal - available, 0),
        swapTotal: SwapTotal,
        swapUsed: Math.max(SwapTotal - SwapFree, 0),
        fields,
    };
}

/**
 * @param {Gio.Cancellable} [cancellable]
 */
export async function readMemory(cancellable) {
    return memoryUsage(parseMeminfo(await readText('/proc/meminfo', cancellable)));
}

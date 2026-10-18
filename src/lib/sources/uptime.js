import {readText} from '../procfs.js';

/**
 * @param {string} text - /proc/uptime
 * @returns {number|null}
 */
export function parseUptime(text) {
    const seconds = Number.parseFloat(text);
    return Number.isFinite(seconds) ? Math.floor(seconds) : null;
}

/**
 * @param {Gio.Cancellable} [cancellable]
 */
export async function readUptime(cancellable) {
    return parseUptime(await readText('/proc/uptime', cancellable));
}

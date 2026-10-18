// Text formatting for the indicators. Unit symbols are not translated, as in XFCE's panel.

// netload's format_byte_humanreadable() (utils.c).
const UNITS = {
    bytes: ['B', 'KiB', 'MiB', 'GiB', 'TiB'],
    bits: ['b', 'Kb', 'Mb', 'Gb', 'Tb'],
};

import GLib from 'gi://GLib';

const numberFormats = new Map();

// Decimal point and grouping of LC_NUMERIC, as XFCE's localeconv(); Intl alone follows LANG.
function numericLocale() {
    const posix = ['LC_ALL', 'LC_NUMERIC', 'LANG'].map(name => GLib.getenv(name)).find(Boolean) ?? '';
    const tag = posix.split(/[.@]/)[0].replace('_', '-');
    try {
        return tag && tag !== 'C' && tag !== 'POSIX' ? Intl.getCanonicalLocales(tag)[0] : undefined;
    } catch {
        return undefined;
    }
}

// The cache is module state: extension.js clears it on disable().
export function clearFormatCache() {
    numberFormats.clear();
}

function numberFormat(digits) {
    let format = numberFormats.get(digits);
    if (!format) {
        format = new Intl.NumberFormat(numericLocale(), {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
        numberFormats.set(digits, format);
    }
    return format;
}

/**
 * Never below kilo ("0.00 KiBps"); steps of 1024 for bytes, 1000 for bits.
 *
 * @param {number} bytes
 * @param {{digits?: number, bits?: boolean, perSecond?: boolean}} [options]
 * @returns {string}
 */
export function formatBytes(bytes, {digits = 2, bits = false, perSecond = false} = {}) {
    const step = bits ? 1000 : 1024;
    const units = bits ? UNITS.bits : UNITS.bytes;
    let value = (bits ? bytes * 8 : bytes) / step;
    let unit = 1;
    while (value >= step && unit < units.length - 1) {
        value /= step;
        unit++;
    }
    if (!(digits >= 0 && digits <= 9))
        digits = 2;
    return `${numberFormat(digits).format(value)} ${units[unit]}${perSecond ? 'ps' : ''}`;
}

const UPTIME_UNITS = [['d', 86400], ['h', 3600], ['m', 60], ['s', 1]];

/**
 * %d days, %h hours, %m minutes, %s seconds; a unit wraps only if a larger one is in the format.
 * XFCE: hours always wrap at 24, so its default "%hh %mm" shows "3h 5m" after 27 hours.
 *
 * @param {string} format
 * @param {number} seconds
 * @returns {string}
 */
export function formatUptime(format, seconds) {
    const values = {};
    let rest = Math.floor(seconds);
    for (const [key, size] of UPTIME_UNITS) {
        if (format.includes(`%${key}`)) {
            values[key] = Math.floor(rest / size);
            rest -= values[key] * size;
        }
    }
    return format.replace(/%([dhms])/g, (_match, key) => String(values[key]));
}

/**
 * @param {number} seconds
 * @returns {{d: number, h: number, m: number, s: number}}
 */
export function splitUptime(seconds) {
    return {
        d: Math.floor(seconds / 86400),
        h: Math.floor(seconds / 3600) % 24,
        m: Math.floor(seconds / 60) % 60,
        s: Math.floor(seconds) % 60,
    };
}

/**
 * Whole MiB rounded down, like systemload's "%ldMB" (KiB >> 10).
 *
 * @param {number} bytes
 * @returns {number}
 */
export function toMiB(bytes) {
    return Math.floor(bytes / 1048576);
}

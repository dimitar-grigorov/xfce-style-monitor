// CPU load from /proc/stat: the busy share of the time elapsed between two samples.
import {readText} from '../procfs.js';

/**
 * The aggregate "cpu" line: user nice system idle iowait irq softirq steal guest guest_nice.
 * XFCE: adds guest to busy (it is already in user) and leaves steal out; differs only in VMs.
 *
 * @param {string} text - /proc/stat
 * @returns {{busy: number, total: number}|null}
 */
export function parseStat(text) {
    const line = text.split('\n', 1)[0];
    const fields = line.trim().split(/\s+/);
    if (fields[0] !== 'cpu' || fields.length < 5)
        return null;

    const [user, nice, system, idle, iowait = 0, irq = 0, softirq = 0, steal = 0] =
        fields.slice(1).map(Number);
    const busy = user + nice + system + irq + softirq;
    return {busy, total: busy + idle + iowait + steal};
}

/**
 * @param {{busy: number, total: number}} prev
 * @param {{busy: number, total: number}} cur
 * @returns {number} 0…1
 */
export function loadBetween(prev, cur) {
    const total = cur.total - prev.total;
    if (total <= 0)
        return 0;
    return Math.min(Math.max((cur.busy - prev.busy) / total, 0), 1);
}

export class CpuSource {
    #prev = null;

    // The first call only primes and returns null. XFCE: the average since boot.
    async read(cancellable) {
        const cur = parseStat(await readText('/proc/stat', cancellable));
        const prev = this.#prev;
        this.#prev = cur;
        if (!cur || !prev)
            return null;
        return {load: loadBetween(prev, cur)};
    }
}

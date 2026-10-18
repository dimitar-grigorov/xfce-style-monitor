// netload's smoothing and automatic maximum, as in netload.c update_monitors().

export const AVERAGE_OF = 4;     // HISTSIZE_CALCULATE: the value shown is the mean of 4 samples
const HISTORY_SIZE = 20;         // HISTSIZE_STORE: how far back the automatic maximum looks
const INIT_MAX = 4096;           // bytes/s
const MINIMAL_MAX = 1024;
const SHRINK_MAX = 0.75;

// One direction (in or out) of one device.
export class RateHistory {
    #history = new Array(HISTORY_SIZE).fill(0); // newest first
    #max = INIT_MAX;

    // netload's setup_monitor() does this on every settings change; the history stays.
    resetMax() {
        this.#max = INIT_MAX;
    }

    /**
     * @param {number} rate - bytes/s
     * @param {number|null} fixedMax - bytes/s of a full bar, or null for the automatic maximum
     * @returns {{average: number, fraction: number}}
     */
    push(rate, fixedMax) {
        this.#history.pop();
        this.#history.unshift(rate);
        let average = 0;
        for (let i = 0; i < AVERAGE_OF; i++)
            average += this.#history[i];
        average /= AVERAGE_OF;

        if (fixedMax === null) {
            const recentMax = Math.max(...this.#history);
            if (average > this.#max)
                this.#max = average;
            else if (recentMax < this.#max * SHRINK_MAX && this.#max * SHRINK_MAX >= MINIMAL_MAX)
                this.#max *= SHRINK_MAX;
        }

        const max = fixedMax ?? this.#max;
        return {average, fraction: max > 0 ? Math.min(average / max, 1) : 0};
    }
}

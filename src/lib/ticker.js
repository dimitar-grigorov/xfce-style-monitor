// Runs an async update every interval, skipping ticks while one is still running.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export class Ticker {
    constructor(name, update) {
        this._name = name;
        this._update = update;
        this._cancellable = new Gio.Cancellable();
        this._sourceId = 0;
        this._busy = false;
        this._lastError = null;
    }

    start(intervalMs) {
        this.stop();
        if (intervalMs === null)
            return;

        const tick = () => {
            this._tick();
            return GLib.SOURCE_CONTINUE;
        };
        // The battery interval is whole seconds: GLib can batch those wakeups with other timers.
        this._sourceId = intervalMs % 1000 === 0
            ? GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, intervalMs / 1000, tick)
            : GLib.timeout_add(GLib.PRIORITY_DEFAULT, intervalMs, tick);
        this._tick();
    }

    stop() {
        if (this._sourceId)
            GLib.source_remove(this._sourceId);
        this._sourceId = 0;
    }

    destroy() {
        this.stop();
        this._cancellable.cancel();
    }

    async _tick() {
        if (this._busy)
            return;
        this._busy = true;
        try {
            await this._update(this._cancellable);
            this._lastError = null;
        } catch (e) {
            if (e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                return;
            if (e.message !== this._lastError)
                console.warn(`[xfce-style-monitor] ${this._name}: ${e.message}`);
            this._lastError = e.message;
        } finally {
            this._busy = false;
        }
    }
}

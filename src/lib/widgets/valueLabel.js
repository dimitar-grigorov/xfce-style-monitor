// A label that only grows, so changing numbers don't jitter (netload's monitor-label.c).
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

export class ValueLabel extends St.Label {
    static {
        GObject.registerClass({GTypeName: 'XsmValueLabel'}, this);
    }

    constructor(params) {
        super({
            style_class: 'xsm-value',
            y_align: Clutter.ActorAlign.CENTER,
            ...params,
        });
        this._widest = 0;
    }

    // Raises both sizes. min_width alone breaks once the text shrinks: natural < minimum, and a
    // horizontal ClutterBoxLayout (Dash to Panel turns every box in its panel horizontal) kills
    // the shell for that with g_error().
    vfunc_get_preferred_width(forHeight) {
        const [min, natural] = super.vfunc_get_preferred_width(forHeight);
        const widest = this._widest ?? 0; // also called from super() in the constructor
        return [Math.max(min, widest), Math.max(natural, widest)];
    }

    setValue(text) {
        if (this.text === text)
            return;
        this.text = text;
        const [, natural] = this.get_preferred_width(-1);
        this._widest = Math.max(this._widest, natural);
    }

    resetWidth() {
        this._widest = 0;
        this.queue_relayout();
    }
}

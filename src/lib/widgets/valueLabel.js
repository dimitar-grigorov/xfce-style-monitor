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

    setValue(text) {
        if (this.text === text)
            return;
        this.text = text;
        const [, natural] = this.get_preferred_width(-1);
        if (natural > this._widest) {
            this._widest = natural;
            this.min_width = natural;
        }
    }

    resetWidth() {
        this._widest = 0;
        this.min_width_set = false;
    }
}

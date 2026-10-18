// Hover tooltip, styled like the dash's app names; above a bottom panel, below a top one.
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const SHOW_DELAY_MS = 300;  // the dash's DASH_ITEM_HOVER_TIMEOUT
const FADE_MS = 100;
const GAP = 6;

// As in the dash: moving from one tooltip to the next shows it without the delay.
let lastHiddenTime = 0;

export class Tooltip {
    // getText() is called only while the tooltip shows.
    constructor(actor, getText) {
        this._actor = actor;
        this._getText = getText;
        this._showId = 0;
        this._label = new St.Label({style_class: 'dash-label xsm-tooltip', visible: false});
        Main.uiGroup.add_child(this._label);

        actor.reactive = true;
        actor.track_hover = true;
        actor.connectObject(
            'notify::hover', () => (actor.hover ? this._scheduleShow() : this._hide()),
            'button-press-event', () => {
                this._hide();
                return Clutter.EVENT_PROPAGATE;
            },
            'destroy', () => this.destroy(),
            this);
    }

    update() {
        if (!this._label.visible)
            return;
        const text = this._getText();
        if (text && text !== this._label.text) {
            this._label.text = text;
            this._place();
        }
    }

    destroy() {
        this._cancelShow();
        this._actor.disconnectObject(this);
        this._label.destroy();
    }

    _scheduleShow() {
        this._cancelShow();
        const recentlyShown = GLib.get_monotonic_time() - lastHiddenTime < SHOW_DELAY_MS * 1000;
        this._showId = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
            recentlyShown ? 0 : SHOW_DELAY_MS, () => {
                this._showId = 0;
                this._show();
                return GLib.SOURCE_REMOVE;
            });
    }

    _cancelShow() {
        if (this._showId)
            GLib.source_remove(this._showId);
        this._showId = 0;
    }

    _show() {
        const text = this._getText();
        if (!text)
            return;
        this._label.text = text;
        this._label.remove_all_transitions();
        this._label.opacity = 0;
        this._label.show();
        this._place();
        this._label.ease({
            opacity: 255,
            duration: FADE_MS,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    _hide() {
        this._cancelShow();
        if (!this._label.visible)
            return;
        lastHiddenTime = GLib.get_monotonic_time();
        this._label.ease({
            opacity: 0,
            duration: FADE_MS,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this._label.hide(),
        });
    }

    _place() {
        const [x, y] = this._actor.get_transformed_position();
        const [width, height] = this._actor.get_transformed_size();
        const monitor = Main.layoutManager.findMonitorForActor(this._actor) ??
            Main.layoutManager.primaryMonitor;
        const [labelWidth, labelHeight] = this._label.get_size();

        const left = Math.clamp(Math.floor(x + (width - labelWidth) / 2),
            monitor.x, monitor.x + monitor.width - labelWidth);
        const below = y + height / 2 < monitor.y + monitor.height / 2;
        const top = below ? y + height + GAP : y - labelHeight - GAP;
        this._label.set_position(left, Math.floor(top));
    }
}

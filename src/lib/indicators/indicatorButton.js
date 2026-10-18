// Base of both indicators: an update timer that runs only while shown, and a Settings menu.
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {Ticker} from '../ticker.js';

export class IndicatorButton extends PanelMenu.Button {
    static {
        GObject.registerClass({GTypeName: 'XsmIndicatorButton'}, this);
    }

    constructor(name, openPreferences) {
        super(0.5, name);
        this.add_style_class_name('xsm-indicator');
        this.menu.addAction(_('Settings'), openPreferences);
        this._ticker = new Ticker(name, cancellable => this._update(cancellable));
        // Hidden panel (fullscreen video, autohide): nothing to show, nothing to read.
        this.connect('notify::mapped', () => this.restart());
    }

    _onDestroy() {
        this._ticker.destroy();
        super._onDestroy();
    }

    // Starts updating now at interval(), if on screen. Call after the interval changed.
    restart() {
        this._ticker.start(this.mapped ? this.interval() : null);
    }

    // ms between updates, or null for none.
    interval() {
        return null;
    }

    async _update(_cancellable) {
    }

    // Left click: nothing, as in netload.
    activate() {
    }

    // PanelMenu.Button opens the menu on any click; here only the right one does.
    vfunc_event(event) {
        if (event.type() === Clutter.EventType.BUTTON_PRESS) {
            if (event.get_button() === Clutter.BUTTON_PRIMARY)
                this.activate();
            else if (event.get_button() === Clutter.BUTTON_SECONDARY)
                this.menu.toggle();
            return Clutter.EVENT_STOP;
        }
        if (event.type() === Clutter.EventType.TOUCH_BEGIN) {
            this.menu.toggle();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }
}

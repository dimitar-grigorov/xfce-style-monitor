// Two independent indicators, like Xfce's two plugins, each switched by "<name>-enabled".
// XFCE: totals and maximum last as long as the panel; here they restart after unlocking.
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {clearFormatCache} from './lib/format.js';
import {NetworkIndicator} from './lib/indicators/network.js';
import {SystemLoadIndicator} from './lib/indicators/systemLoad.js';

// Panel order, left to right, as the prefs pages.
const INDICATORS = [
    ['system-load', SystemLoadIndicator],
    ['network', NetworkIndicator],
];

export default class XfceStyleMonitor extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicators = new Map();
        for (const [name] of INDICATORS) {
            this._settings.connectObject(`changed::${name}-enabled`, () => this._sync(name), this);
            this._sync(name);
        }
    }

    disable() {
        this._settings.disconnectObject(this);
        for (const indicator of this._indicators.values())
            indicator.destroy();
        this._indicators = null;
        this._settings = null;
        clearFormatCache();
    }

    // Opens the prefs on a page (see prefs.js); an already open window is raised instead.
    _openPreferences(page) {
        this._settings.set_string('prefs-page', page);
        const open = global.get_window_actors().map(actor => actor.meta_window).find(window =>
            window.wm_class === 'org.gnome.Shell.Extensions' &&
            window.title === this.metadata.name);
        if (open)
            Main.activateWindow(open);
        else
            this.openPreferences();
    }

    _sync(name) {
        const wanted = this._settings.get_boolean(`${name}-enabled`);
        const indicator = this._indicators.get(name);
        if (wanted && !indicator) {
            const Indicator = INDICATORS.find(([n]) => n === name)[1];
            // Start of the right box, in INDICATORS order among those shown.
            const position = INDICATORS.findIndex(([n]) => n === name);
            const before = INDICATORS.slice(0, position).filter(([n]) => this._indicators.has(n));
            this._indicators.set(name,
                new Indicator(this._settings, () => this._openPreferences(name)));
            Main.panel.addToStatusArea(`${this.uuid}:${name}`, this._indicators.get(name),
                before.length, 'right');
        } else if (!wanted && indicator) {
            indicator.destroy();
            this._indicators.delete(name);
        }
    }
}

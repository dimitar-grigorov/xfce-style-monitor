// xfce4-systemload-plugin: cpu, mem and swap bars, uptime; left click runs the system monitor.
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {gettext as _, ngettext} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {formatUptime, splitUptime, toMiB} from '../format.js';
import {PowerState} from '../power.js';
import {CpuSource} from '../sources/cpu.js';
import {readMemory} from '../sources/memory.js';
import {readUptime} from '../sources/uptime.js';
import {Bar} from '../widgets/bar.js';
import {Tooltip} from '../widgets/tooltip.js';
import {IndicatorButton} from './indicatorButton.js';

// Settings prefix, accessible name, in panel order. XFCE: also a "net" bar; netload covers that.
const MONITORS = [
    ['cpu', () => _('CPU')],
    ['memory', () => _('Memory')],
    ['swap', () => _('Swap')],
];

function createMonitor(accessibleName, getTooltip) {
    const label = new St.Label({style_class: 'xsm-label', y_align: Clutter.ActorAlign.CENTER});
    const bar = new Bar();
    const box = new St.BoxLayout({style_class: 'xsm-monitor', accessible_name: accessibleName});
    box.add_child(label);
    box.add_child(bar);
    return {label, bar, box, tooltip: new Tooltip(box, getTooltip)};
}

export class SystemLoadIndicator extends IndicatorButton {
    static {
        GObject.registerClass({GTypeName: 'XsmSystemLoadIndicator'}, this);
    }

    constructor(settings, openPreferences) {
        super(_('System Load Monitor'), openPreferences);
        this._settings = settings;
        this._data = {};

        this._box = new St.BoxLayout({style_class: 'xsm-box'});
        this.add_child(this._box);

        this._monitors = {};
        for (const [key, name] of MONITORS) {
            this._monitors[key] = createMonitor(name(), () => this._tooltipText(key));
            this._box.add_child(this._monitors[key].box);
        }
        this._uptime = new St.Label({
            style_class: 'xsm-label',
            y_align: Clutter.ActorAlign.CENTER,
            accessible_name: _('Uptime'),
        });
        this._uptimeTooltip = new Tooltip(this._uptime, () => this._tooltipText('uptime'));
        this._box.add_child(this._uptime);

        this._cpu = new CpuSource();
        this._power = null;

        settings.connectObject('changed', (_s, key) => this._onSettingChanged(key), this);
        this._syncAppearance();
        this._syncPower();
        this.restart();
    }

    _onDestroy() {
        this._power?.destroy();
        this._settings.disconnectObject(this);
        this._settings = null;
        this._monitors = null;
        super._onDestroy();
    }

    // setup_timer(): on battery the power-saving interval; on battery with the lid closed, none.
    interval() {
        if (!this._power?.onBattery)
            return this._settings.get_uint('system-load-interval');
        if (this._power.lidClosed)
            return null;
        return this._settings.get_uint('system-load-battery-interval') * 1000;
    }

    activate() {
        const command = this._settings.get_string('system-load-command').trim();
        if (!command)
            return;
        // The .desktop file first: finds Flatpak installs, raises an open window.
        const apps = Shell.AppSystem.get_default();
        const app = apps.lookup_app(command.endsWith('.desktop') ? command : `${command}.desktop`) ??
            (command === 'gnome-system-monitor'
                ? apps.lookup_app('org.gnome.SystemMonitor.desktop') : null);
        try {
            if (app) {
                app.activate();
                Main.overview.hide();
            } else {
                Gio.AppInfo.create_from_commandline(command, null, Gio.AppInfoCreateFlags.NONE)
                    .launch([], global.create_app_launch_context(0, -1));
            }
        } catch (e) {
            Main.notifyError(_('Could not run “%s”').format(command), e.message);
        }
    }

    _onSettingChanged(key) {
        if (key === 'system-load-battery-interval')
            this._syncPower();
        if (key === 'system-load-interval' || key === 'system-load-battery-interval') {
            this.restart();
        } else if (/^(cpu|memory|swap|uptime)-/.test(key)) {
            this._syncAppearance();
            this.restart(); // show a newly enabled monitor's value right away
        }
    }

    _syncAppearance() {
        const s = this._settings;
        let labels = 0;
        for (const [key, monitor] of Object.entries(this._monitors)) {
            const label = s.get_string(`${key}-label`);
            monitor.box.visible = s.get_boolean(`${key}-enabled`);
            monitor.label.text = label;
            monitor.label.visible = label !== '';
            monitor.bar.setColor(s.get_string(`${key}-color`));
            if (monitor.box.visible && label)
                labels++;
        }
        this._uptime.visible = s.get_boolean('uptime-enabled');
        // setup_monitors(): bars without any label sit side by side.
        this._box.style = labels ? null : 'spacing: 0;';
    }

    _syncPower() {
        const wanted = this._settings.get_uint('system-load-battery-interval') > 0;
        if (wanted && !this._power) {
            this._power = new PowerState(() => this.restart());
        } else if (!wanted && this._power) {
            this._power.destroy();
            this._power = null;
        }
    }

    async _update(cancellable) {
        const {cpu, memory, swap} = this._monitors;
        const [load, mem, uptime] = await Promise.all([
            cpu.box.visible ? this._cpu.read(cancellable) : null,
            memory.box.visible || swap.box.visible ? readMemory(cancellable) : null,
            this._uptime.visible ? readUptime(cancellable) : null,
        ]);
        if (cancellable.is_cancelled())
            return; // destroyed while reading

        if (load) {
            this._data.load = load.load;
            cpu.bar.setFraction(load.load);
            cpu.tooltip.update();
        }
        if (mem) {
            this._data.mem = mem;
            memory.bar.setFraction(mem.memUsed / mem.memTotal);
            swap.bar.setFraction(mem.swapTotal ? mem.swapUsed / mem.swapTotal : 0);
            memory.tooltip.update();
            swap.tooltip.update();
        }
        if (uptime !== null) {
            this._data.uptime = uptime;
            this._uptime.text = formatUptime(this._settings.get_string('uptime-format'), uptime);
            this._uptimeTooltip.update();
        }
    }

    _tooltipText(key) {
        const {load, mem, uptime} = this._data;
        switch (key) {
        case 'cpu':
            // XFCE prints an integer percentage: truncated, not rounded.
            return load === undefined ? '' : _('System Load: %d%%').format(Math.floor(load * 100));
        case 'memory':
            return mem
                ? _('Memory: %dMB of %dMB used').format(toMiB(mem.memUsed), toMiB(mem.memTotal))
                : '';
        case 'swap':
            if (!mem)
                return '';
            return mem.swapTotal
                ? _('Swap: %dMB of %dMB used').format(toMiB(mem.swapUsed), toMiB(mem.swapTotal))
                : _('No swap');
        default: {
            if (uptime === undefined)
                return '';
            const {d, h, m} = splitUptime(uptime);
            return _('Uptime: %s, %s, %s').format(
                ngettext('%d day', '%d days', d).format(d),
                ngettext('%d hour', '%d hours', h).format(h),
                ngettext('%d minute', '%d minutes', m).format(m));
        }
        }
    }
}

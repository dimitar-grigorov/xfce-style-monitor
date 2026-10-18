// netload's dialog (netload.c monitor_create_options()), same options in the same order.
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {readText, readTextOrNull} from '../lib/procfs.js';
import {AUTO_DEVICE, isValidDeviceName, parseDefaultRoute, parseNetDev}
    from '../lib/sources/network.js';

const PRESENT_AS = [
    ['bars', () => _('Bars')],
    ['values', () => _('Values')],
    ['bars-and-values', () => _('Bars and values')],
];

/** @param {import('./rows.js').Rows} rows */
export function networkPage(rows) {
    const page = new Adw.PreferencesPage({
        name: 'network',
        title: _('Network'),
        icon_name: 'network-transmit-receive-symbolic',
    });

    const shown = new Adw.PreferencesGroup();
    shown.add(rows.switchRow('network-enabled', _('Show Network Monitor')));
    page.add(shown);

    const general = new Adw.PreferencesGroup();
    const text = rows.entryRow('network-label', _('Text to display'));
    const useText = new Gtk.CheckButton({valign: Gtk.Align.CENTER});
    rows.settings.bind('network-use-label', useText, 'active', Gio.SettingsBindFlags.DEFAULT);
    text.add_prefix(useText);
    general.add(text);
    general.add(deviceRow(rows));
    general.add(rows.spinRow('network-interval', _('Update interval (s)'),
        {min: 0.1, max: 10, step: 0.05, digits: 2, scale: 1000}));
    general.add(rows.switchRow('network-cumulative', _('Show cumulative values')));
    general.add(rows.switchRow('network-bits', _('Show values as bits')));
    page.add(general);

    const maximum = new Adw.PreferencesGroup();
    maximum.add(rows.switchRow('network-auto-max', _('Automatic maximum')));
    for (const [key, title] of [['network-max-in', _('Maximum (incoming, KiB/s)')],
        ['network-max-out', _('Maximum (outgoing, KiB/s)')]]) {
        const row = rows.spinRow(key, title, {min: 1, max: 10 ** 7, step: 1});
        rows.sensitiveWhen('network-auto-max', row, true);
        maximum.add(row);
    }
    page.add(maximum);

    const look = new Adw.PreferencesGroup();
    look.add(presentAsRow(rows));
    look.add(rows.colorRow('network-color-in', _('Bar color (incoming)')));
    look.add(rows.colorRow('network-color-out', _('Bar color (outgoing)')));
    look.add(rows.switchRow('network-colorize', _('Colorize values')));
    look.add(rows.spinRow('network-digits', _('Digits number'), {min: 0, max: 5, step: 1}));
    page.add(look);

    for (const group of [general, maximum, look])
        rows.sensitiveWhen('network-enabled', group);
    return page;
}

function presentAsRow(rows) {
    const row = new Adw.ComboRow({
        title: _('Present data as'),
        model: Gtk.StringList.new(PRESENT_AS.map(([, title]) => title())),
    });
    rows.onChange(['network-present-as'], () => {
        const value = rows.settings.get_string('network-present-as');
        row.selected = Math.max(PRESENT_AS.findIndex(([v]) => v === value), 0);
    });
    row.connect('notify::selected', () =>
        rows.settings.set_string('network-present-as', PRESENT_AS[row.selected][0]));
    return row;
}

// auto, then the devices; a configured one that is missing stays selectable.
// XFCE: all interfaces in kernel order; here physical first, no loopback.
function deviceRow(rows) {
    const row = new Adw.ComboRow({
        title: _('Network device'),
        subtitle: _('“auto” follows the default route'),
    });
    let devices = [];

    const select = () => {
        const index = devices.indexOf(rows.settings.get_string('network-device'));
        if (index >= 0 && row.selected !== index)
            row.selected = index;
    };
    const fill = async () => {
        let names = [];
        let current = null;
        try {
            names = await sortedDevices([...parseNetDev(await readText('/proc/net/dev')).keys()]);
            current = parseDefaultRoute(await readText('/proc/net/route'));
        } catch (e) {
            console.warn(`[xfce-style-monitor] listing network devices: ${e.message}`);
        }
        const configured = rows.settings.get_string('network-device');
        devices = [AUTO_DEVICE, ...names];
        if (!devices.includes(configured))
            devices.push(configured);
        const auto = current ? `${AUTO_DEVICE} (${current})` : AUTO_DEVICE;
        row.model = Gtk.StringList.new([auto, ...devices.slice(1)]);
        select();
        row.connect('notify::selected', () => {
            const device = devices[row.selected];
            if (device && device !== rows.settings.get_string('network-device'))
                rows.settings.set_string('network-device', device);
        });
        rows.onChange(['network-device'], select);
    };
    fill();
    return row;
}

async function sortedDevices(names) {
    names = names.filter(name => name !== 'lo' && isValidDeviceName(name));
    // Only devices backed by hardware have /sys/class/net/<name>/device.
    const physical = await Promise.all(names.map(async name =>
        await readTextOrNull(`/sys/class/net/${name}/device/uevent`) !== null));
    return [...names.filter((_n, i) => physical[i]), ...names.filter((_n, i) => !physical[i])];
}

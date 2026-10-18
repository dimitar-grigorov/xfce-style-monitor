// systemload's dialog (systemload.cc monitor_create_options()), same options in the same order.
import Adw from 'gi://Adw';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const MONITORS = [
    ['cpu', () => _('CPU monitor')],
    ['memory', () => _('Memory monitor')],
    ['swap', () => _('Swap monitor')],
];

/** @param {import('./rows.js').Rows} rows */
export function systemLoadPage(rows) {
    const page = new Adw.PreferencesPage({
        name: 'system-load',
        title: _('System Load'),
        icon_name: 'utilities-system-monitor-symbolic',
    });

    const shown = new Adw.PreferencesGroup();
    shown.add(rows.switchRow('system-load-enabled', _('Show System Load Monitor')));
    page.add(shown);

    const general = new Adw.PreferencesGroup({title: _('General')});
    general.add(rows.spinRow('system-load-interval', _('Update interval (ms)'),
        {min: 500, max: 10000, step: 50}));
    general.add(rows.spinRow('system-load-battery-interval', _('Power-saving interval (s)'), {
        min: 0, max: 10, step: 1,
        subtitle: _('Update interval when running on battery (uses regular update interval if set to zero)'),
    }));
    const command = rows.entryRow('system-load-command', _('System monitor'));
    command.tooltip_text = _('Launched when clicking on the plugin');
    general.add(command);
    page.add(general);

    const groups = [general];
    for (const [key, title] of MONITORS) {
        const group = new Adw.PreferencesGroup({
            title: title(),
            header_suffix: rows.headerSwitch(`${key}-enabled`),
        });
        const label = rows.entryRow(`${key}-label`, _('Label'));
        label.tooltip_text = _('Leave empty to disable the label');
        label.add_suffix(rows.colorButton(`${key}-color`, title()));
        rows.sensitiveWhen(`${key}-enabled`, label);
        group.add(label);
        page.add(group);
        groups.push(group);
    }

    const uptime = new Adw.PreferencesGroup({
        title: _('Uptime monitor'),
        header_suffix: rows.headerSwitch('uptime-enabled'),
    });
    const format = rows.entryRow('uptime-format', _('Label'));
    format.tooltip_text = _('%d days, %h hours, %m minutes, %s seconds');
    rows.sensitiveWhen('uptime-enabled', format);
    uptime.add(format);
    page.add(uptime);
    groups.push(uptime);

    for (const group of groups)
        rows.sensitiveWhen('system-load-enabled', group);
    return page;
}

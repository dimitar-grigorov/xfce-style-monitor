// One page per indicator, like XFCE's two settings dialogs.
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {networkPage} from './prefs/networkPage.js';
import {Rows} from './prefs/rows.js';
import {systemLoadPage} from './prefs/systemLoadPage.js';

export default class XfceStyleMonitorPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const rows = new Rows(this.getSettings(), window);
        window.set_default_size(560, 760);
        window.add(systemLoadPage(rows));
        window.add(networkPage(rows));

        // Opened from an indicator's menu: start on its page (extension.js _openPreferences).
        rows.onChange(['prefs-page'], () => {
            const page = rows.settings.get_string('prefs-page');
            if (page) {
                window.visible_page_name = page;
                rows.settings.reset('prefs-page');
            }
        });
    }
}

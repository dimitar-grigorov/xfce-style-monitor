// Small builders for preference rows bound to settings keys.
import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

export class Rows {
    /**
     * @param {Gio.Settings} settings
     * @param {Adw.PreferencesWindow} window - handlers are dropped when it closes
     */
    constructor(settings, window) {
        this.settings = settings;
        this._handlers = [];
        window.connect('close-request', () => {
            for (const id of this._handlers)
                settings.disconnect(id);
            this._handlers = [];
        });
    }

    /** Calls callback now and whenever one of the keys changes. */
    onChange(keys, callback) {
        for (const key of keys)
            this._handlers.push(this.settings.connect(`changed::${key}`, callback));
        callback();
    }

    switchRow(key, title, subtitle = '') {
        const row = new Adw.SwitchRow({title, subtitle});
        this.settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }

    /** A switch for a group's header, like XFCE's switch next to "CPU monitor". */
    headerSwitch(key) {
        const sw = new Gtk.Switch({valign: Gtk.Align.CENTER});
        this.settings.bind(key, sw, 'active', Gio.SettingsBindFlags.DEFAULT);
        return sw;
    }

    spinRow(key, title, {min, max, step, subtitle = '', digits = 0, scale = 1}) {
        const row = new Adw.SpinRow({
            title,
            subtitle,
            digits,
            adjustment: new Gtk.Adjustment({lower: min, upper: max, step_increment: step,
                page_increment: step * 10}),
        });
        if (scale === 1) {
            this.settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
        } else {
            // e.g. milliseconds in settings shown as seconds
            this.onChange([key], () => {
                const value = this.settings.get_uint(key) / scale;
                if (row.value !== value)
                    row.value = value;
            });
            row.connect('notify::value', () => {
                const value = Math.round(row.value * scale);
                if (this.settings.get_uint(key) !== value)
                    this.settings.set_uint(key, value);
            });
        }
        return row;
    }

    /** Applies on Enter or the apply button, so the panel doesn't follow every keystroke. */
    entryRow(key, title) {
        const row = new Adw.EntryRow({title, show_apply_button: true});
        this.onChange([key], () => {
            row.text = this.settings.get_string(key);
        });
        row.connect('apply', () => this.settings.set_string(key, row.text));
        return row;
    }

    colorButton(key, title) {
        const button = new Gtk.ColorDialogButton({
            dialog: new Gtk.ColorDialog({title, with_alpha: true}),
            valign: Gtk.Align.CENTER,
        });
        this.onChange([key], () => {
            const rgba = new Gdk.RGBA();
            if (rgba.parse(this.settings.get_string(key)) && !rgba.equal(button.rgba))
                button.rgba = rgba;
        });
        button.connect('notify::rgba', () => {
            const value = button.rgba.to_string();
            const current = new Gdk.RGBA();
            if (!current.parse(this.settings.get_string(key)) || !current.equal(button.rgba))
                this.settings.set_string(key, value);
        });
        return button;
    }

    colorRow(key, title) {
        const row = new Adw.ActionRow({title});
        const button = this.colorButton(key, title);
        row.add_suffix(button);
        row.activatable_widget = button;
        return row;
    }

    /** widget is sensitive while the boolean key is true (false with invert). */
    sensitiveWhen(key, widget, invert = false) {
        let flags = Gio.SettingsBindFlags.GET;
        if (invert)
            flags |= Gio.SettingsBindFlags.INVERT_BOOLEAN;
        this.settings.bind(key, widget, 'sensitive', flags);
    }
}

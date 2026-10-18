#!/usr/bin/env bash
# Development loop without logging out.
#
#   scripts/dev.sh          link + compile schemas, then a nested GNOME Shell in a window
#                           with the extension enabled; close the window to stop it
#   scripts/dev.sh prefs    the same, and open the preferences window inside it
#   scripts/dev.sh link     only link + compile schemas (for a re-login of the real session)
#
# The nested shell shares dconf with the real session, so all its extensions (Dash to Panel
# included) and this extension's settings are the real ones. Its log goes to this terminal.
# WIDTHxHEIGHT of the window: DEV_SIZE=1920x1080 scripts/dev.sh
set -euo pipefail

src=$(cd "$(dirname "$0")/../src" && pwd)
uuid=$(sed -n 's/^ *"uuid": *"\([^"]*\)".*/\1/p' "$src/metadata.json")
target="$HOME/.local/share/gnome-shell/extensions/$uuid"

link() {
    mkdir -p "$(dirname "$target")"
    if [[ -e $target && ! -L $target ]]; then
        echo "$target exists and is not a symlink, not touching it" >&2
        exit 1
    fi
    ln -sfn "$src" "$target"
    glib-compile-schemas --strict "$src/schemas"
}

# The real shell ignores an extension it didn't find at login, so this only matters for the
# nested shell (and for the next login, which is intended).
enable_in_dconf() {
    gjs -c "
        const {Gio} = imports.gi;
        const s = new Gio.Settings({schema_id: 'org.gnome.shell'});
        const list = s.get_strv('enabled-extensions');
        if (!list.includes('$uuid'))
            s.set_strv('enabled-extensions', [...list, '$uuid']);
        Gio.Settings.sync();"
}

nested() {
    # GNOME 49 replaced --nested with --devkit (mutter-dev-bin).
    local mode=(--nested --wayland)
    gnome-shell --help 2>&1 | grep -q -- --devkit && mode=(--devkit --wayland)

    export MUTTER_DEBUG_DUMMY_MODE_SPECS=${DEV_SIZE:-1600x900}
    export SHELL_DEBUG=backtrace-warnings
    # The nested shell draws into a window of the real session (WAYLAND_DISPLAY), and serves
    # its own socket. Apps it starts directly get that socket from the shell; D-Bus activated
    # ones (the prefs window) get it from the activation environment set below.
    dbus-run-session -- bash -c '
        gnome-shell "$@" --wayland-display=xfce-style-monitor-dev &
        shell=$!
        until gdbus introspect --session --dest org.gnome.Shell \
                --object-path /org/gnome/Shell >/dev/null 2>&1; do
            kill -0 $shell 2>/dev/null || exit 1
            sleep 0.5
        done
        dbus-update-activation-environment WAYLAND_DISPLAY=xfce-style-monitor-dev DISPLAY=
        if [[ $OPEN_PREFS == 1 ]]; then
            sleep 2
            gnome-extensions prefs "$UUID" || true
        fi
        wait $shell' _ "${mode[@]}"
}

case ${1:-} in
    link)
        link
        ;;
    prefs)
        link
        enable_in_dconf
        OPEN_PREFS=1 UUID=$uuid nested
        ;;
    '')
        link
        enable_in_dconf
        OPEN_PREFS=0 UUID=$uuid nested
        ;;
    *)
        sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
        exit 2
        ;;
esac

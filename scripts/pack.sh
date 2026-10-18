#!/usr/bin/env bash
# Builds dist/<uuid>.shell-extension.zip, the file for Releases and extensions.gnome.org.
#   scripts/pack.sh        build
#   scripts/pack.sh -i     build and install it for this user (log out and in to load it)
set -euo pipefail
cd "$(dirname "$0")/.."

# From src/: metadata.json, extension.js, prefs.js, stylesheet.css and schemas/ by default.
# The output folder must exist: gnome-extensions 48 crashes otherwise.
mkdir -p dist
gnome-extensions pack src --force --out-dir=dist \
    --extra-source=lib --extra-source=prefs --extra-source=../LICENSE
zip=$(ls dist/*.shell-extension.zip)
echo "$zip"

if [[ ${1:-} == -i ]]; then
    gnome-extensions install --force "$zip"
    echo 'Installed. Log out and in, then: gnome-extensions enable' \
        "$(basename "$zip" .shell-extension.zip)"
fi

# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/). A release tag `vX` publishes the
section `[X]` as the release notes.

## [Unreleased]

## [0.3] - 2026-10-22

### Fixed
- GNOME Shell could crash with Dash to Panel and network values shown: a value getting shorter
  left a label's natural width below its minimum, which Clutter treats as a fatal error.

## [0.2] - 2026-10-18

### Changed
- New UUID `xfce-style-monitor@dimitar-grigorov.github.io`, as extensions.gnome.org requires.
  Remove 0.1 (`gnome-extensions uninstall xfce-style-monitor@grigorov`) before installing.
- NetworkManager is loaded without a fixed version.

## [0.1] - 2026-10-18

First release, for GNOME 48.

### Added
- System Load indicator: CPU, memory and swap bars with labels, uptime, tooltips, left click
  runs the system monitor, power-saving interval on battery.
- Network indicator: in/out bars and/or values, automatic or fixed maximum, cumulative values,
  "auto" device following the default route, tooltip with the IP address.
- Preferences with one page per indicator; right-click an indicator for its settings.

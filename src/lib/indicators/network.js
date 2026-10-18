// xfce4-netload-plugin: label, incoming value, in/out bars, outgoing value.
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {formatBytes} from '../format.js';
import {AVERAGE_OF, RateHistory} from '../netload.js';
import {IpAddressSource} from '../sources/ipAddress.js';
import {NetworkSource} from '../sources/network.js';
import {Bar} from '../widgets/bar.js';
import {Tooltip} from '../widgets/tooltip.js';
import {ValueLabel} from '../widgets/valueLabel.js';
import {IndicatorButton} from './indicatorButton.js';

const NO_VALUE = '-';

// One direction: value, cumulative value under it, bar, smoothing.
class Direction {
    constructor(accessibleName) {
        this.value = new ValueLabel({text: NO_VALUE});
        this.cumulative = new ValueLabel({text: NO_VALUE});
        this.values = new St.BoxLayout({
            style_class: 'xsm-values',
            orientation: Clutter.Orientation.VERTICAL,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.values.add_child(this.value);
        this.values.add_child(this.cumulative);
        this.bar = new Bar({accessible_name: accessibleName});
        this.history = new RateHistory();
    }
}

export class NetworkIndicator extends IndicatorButton {
    static {
        GObject.registerClass({GTypeName: 'XsmNetworkIndicator'}, this);
    }

    constructor(settings, openPreferences) {
        super(_('Network Monitor'), openPreferences);
        this._settings = settings;
        this._sample = null;

        this._in = new Direction(_('Incoming'));
        this._out = new Direction(_('Outgoing'));

        const box = new St.BoxLayout({style_class: 'xsm-box xsm-network'});
        this._label = new St.Label({style_class: 'xsm-label', y_align: Clutter.ActorAlign.CENTER});
        this._bars = new St.BoxLayout({style_class: 'xsm-bars'});
        this._bars.add_child(this._in.bar);
        this._bars.add_child(this._out.bar);
        box.add_child(this._label);
        box.add_child(this._in.values);
        box.add_child(this._bars);
        box.add_child(this._out.values);
        this.add_child(box);
        this._tooltip = new Tooltip(box, () => this._tooltipText());

        this._addresses = new IpAddressSource();

        settings.connectObject('changed', (_s, key) => {
            if (key.startsWith('network-'))
                this._sync(key);
        }, this);
        this._sync();
    }

    _onDestroy() {
        this._addresses.destroy();
        this._settings.disconnectObject(this);
        this._settings = null;
        super._onDestroy();
    }

    interval() {
        return this._settings.get_uint('network-interval');
    }

    // setup_monitor(): a new device starts over; other settings only reset the maximum.
    _sync(key = null) {
        const s = this._settings;
        const presentAs = s.get_string('network-present-as');
        const autoMax = s.get_boolean('network-auto-max');
        this._options = {
            format: {digits: s.get_uint('network-digits'), bits: s.get_boolean('network-bits')},
            showValues: presentAs !== 'bars',
            cumulative: s.get_boolean('network-cumulative'),
            maxIn: autoMax ? null : s.get_uint('network-max-in') * 1024,
            maxOut: autoMax ? null : s.get_uint('network-max-out') * 1024,
        };

        // XFCE: auto mode shows the device name here; the tooltip names it instead.
        const label = s.get_string('network-label');
        this._label.visible = s.get_boolean('network-use-label') && label !== '';
        this._label.text = label;
        this._bars.visible = presentAs !== 'values';

        const colorize = s.get_boolean('network-colorize');
        for (const [direction, colorKey] of [[this._in, 'network-color-in'],
            [this._out, 'network-color-out']]) {
            const color = s.get_string(colorKey);
            direction.bar.setColor(color);
            direction.history.resetMax();
            direction.values.visible = this._options.showValues;
            direction.cumulative.visible = this._options.cumulative;
            for (const value of [direction.value, direction.cumulative]) {
                value.style = colorize ? `color: ${color};` : null;
                value.resetWidth();
            }
        }

        if (key === null || key === 'network-device') {
            this._source = new NetworkSource(s.get_string('network-device'));
            this._sample = null;
            for (const direction of [this._in, this._out])
                direction.history = new RateHistory();
            this._showDown(); // until the first full sample
        }
        if (key === null || key === 'network-interval')
            this.restart();
    }

    async _update(cancellable) {
        const source = this._source;
        const sample = await source.read(cancellable);
        // Destroyed, or the device changed while reading: this sample belongs to the old one.
        if (cancellable.is_cancelled() || source !== this._source)
            return;

        if (!sample.up) {
            this._sample = sample;
            this._showDown();
            return;
        }
        if (sample.rx === undefined)
            return; // priming sample

        const rx = this._in.history.push(sample.rx, this._options.maxIn);
        const tx = this._out.history.push(sample.tx, this._options.maxOut);
        this._sample = {...sample, rxAverage: rx.average, txAverage: tx.average};
        this._in.bar.setFraction(rx.fraction);
        this._out.bar.setFraction(tx.fraction);

        if (this._options.showValues) {
            this._in.value.setValue(this._rate(rx.average));
            this._out.value.setValue(this._rate(tx.average));
            if (this._options.cumulative) {
                this._in.cumulative.setValue(this._amount(sample.rxTotal));
                this._out.cumulative.setValue(this._amount(sample.txTotal));
            }
        }
        this._tooltip.update();
    }

    // XFCE: the last values stay when the interface goes down; here empty bars and "-".
    _showDown() {
        for (const direction of [this._in, this._out]) {
            direction.bar.setFraction(0);
            direction.value.setValue(NO_VALUE);
            direction.cumulative.setValue(NO_VALUE);
        }
        this._tooltip.update();
    }

    _rate(bytes) {
        return formatBytes(bytes, {...this._options.format, perSecond: true});
    }

    _amount(bytes) {
        return formatBytes(bytes, this._options.format);
    }

    // The texts of update_monitors().
    _tooltipText() {
        const sample = this._sample;
        if (!sample)
            return '';
        if (!sample.device)
            return _('No default route');
        if (!sample.up)
            return _('<< %s >> (Interface down)').format(sample.device);

        // Looked up only here, so NetworkManager is loaded on the first hover.
        const address = this._addresses.lookup(sample.device);
        const lines = [
            address === undefined
                ? `<< ${sample.device} >>`
                : `<< ${sample.device} >> (${address ?? _('no IP address')})`,
            _('Average of last %d measures\nwith an interval of %.2fs:')
                .format(AVERAGE_OF, this.interval() / 1000),
            _('Incoming: %s').format(this._rate(sample.rxAverage)),
            _('Outgoing: %s').format(this._rate(sample.txAverage)),
            _('Total: %s').format(this._rate(sample.rxAverage + sample.txAverage)),
        ];
        if (this._options.cumulative) {
            lines.push(_('Cumulative:'),
                _('Incoming: %s').format(this._amount(sample.rxTotal)),
                _('Outgoing: %s').format(this._amount(sample.txTotal)),
                _('Total: %s').format(this._amount(sample.rxTotal + sample.txTotal)));
        }
        return lines.join('\n');
    }
}

// On battery / lid closed, from UPower over D-Bus.
import Gio from 'gi://Gio';

const UPowerProxy = Gio.DBusProxy.makeProxyWrapper(`
<node>
  <interface name="org.freedesktop.UPower">
    <property name="OnBattery" type="b" access="read"/>
    <property name="LidIsClosed" type="b" access="read"/>
  </interface>
</node>`);

export class PowerState {
    // onChanged: once the proxy is ready, then on every change.
    constructor(onChanged) {
        this._cancellable = new Gio.Cancellable();
        this._proxy = null;
        new UPowerProxy(Gio.DBus.system, 'org.freedesktop.UPower', '/org/freedesktop/UPower',
            (proxy, error) => {
                if (error)
                    return; // no UPower: behave as on mains
                this._proxy = proxy;
                proxy.connectObject('g-properties-changed', () => onChanged(), this);
                onChanged();
            }, this._cancellable);
    }

    get onBattery() {
        return this._proxy?.OnBattery ?? false;
    }

    get lidClosed() {
        return this._proxy?.LidIsClosed ?? false;
    }

    destroy() {
        this._cancellable.cancel();
        this._proxy?.disconnectObject(this);
        this._proxy = null;
    }
}

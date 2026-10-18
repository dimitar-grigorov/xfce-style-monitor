// A device's IPv4 address, from NetworkManager.
// XFCE: an ioctl, also without NetworkManager; here the IP is then left out.
import Gio from 'gi://Gio';

export class IpAddressSource {
    constructor() {
        this._cancellable = new Gio.Cancellable();
        this._client = null;
        this._started = false;
    }

    // The first IPv4 address; null when there is none; undefined without NetworkManager.
    lookup(device) {
        if (!this._started)
            this._start();
        if (!this._client?.nm_running)
            return undefined;
        const addresses = this._client.get_device_by_iface(device)?.get_ip4_config()
            ?.get_addresses();
        return addresses?.[0]?.get_address() ?? null;
    }

    destroy() {
        this._cancellable.cancel();
        this._client = null;
    }

    async _start() {
        this._started = true;
        try {
            const {default: NM} = await import('gi://NM?version=1.0');
            Gio._promisify(NM.Client, 'new_async');
            this._client = await NM.Client.new_async(this._cancellable);
        } catch (e) {
            if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                console.debug(`[xfce-style-monitor] no NetworkManager client: ${e.message}`);
        }
    }
}

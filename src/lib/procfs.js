// Async reads of small /proc and /sys files.
// XFCE: blocking reads; in the shell process those would stall the desktop.
import Gio from 'gi://Gio';

Gio._promisify(Gio.File.prototype, 'load_contents_async');

const decoder = new TextDecoder();

/**
 * @param {string} path
 * @param {Gio.Cancellable} [cancellable]
 * @returns {Promise<string>}
 */
export async function readText(path, cancellable = null) {
    const [contents] = await Gio.File.new_for_path(path).load_contents_async(cancellable);
    return decoder.decode(contents);
}

/**
 * A missing or unreadable file gives null; cancellation still throws.
 *
 * @param {string} path
 * @param {Gio.Cancellable} [cancellable]
 * @returns {Promise<string|null>}
 */
export async function readTextOrNull(path, cancellable = null) {
    try {
        return await readText(path, cancellable);
    } catch (e) {
        if (e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
            throw e;
        return null;
    }
}

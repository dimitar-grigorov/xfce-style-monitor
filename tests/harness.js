// Minimal test helpers for `gjs -m`: no framework to install.
import System from 'system';

let failures = 0;

export function test(name, fn) {
    try {
        fn();
        print(`ok   ${name}`);
    } catch (e) {
        failures++;
        printerr(`FAIL ${name}\n     ${e.message}`);
    }
}

export function equal(actual, expected, what = '') {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e)
        throw new Error(`${what ? `${what}: ` : ''}expected ${e}, got ${a}`);
}

export function near(actual, expected, epsilon = 1e-9, what = '') {
    if (Math.abs(actual - expected) > epsilon)
        throw new Error(`${what ? `${what}: ` : ''}expected ${expected} +/- ${epsilon}, got ${actual}`);
}

export function done() {
    if (failures)
        System.exit(1);
}

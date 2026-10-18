import {formatBytes, formatUptime, toMiB} from '../src/lib/format.js';
import {RateHistory} from '../src/lib/netload.js';
import {test, equal, near, done} from './harness.js';

// Number formatting follows the locale; tests/run.sh pins it to en_US.

test('bytes: netload starts at kilo', () => {
    equal(formatBytes(0, {perSecond: true}), '0.00 KiBps');
    equal(formatBytes(512, {digits: 1}), '0.5 KiB');
    equal(formatBytes(1024 * 1024, {perSecond: true}), '1.00 MiBps');
    equal(formatBytes(1536 * 1024 * 1024, {digits: 0}), '2 GiB');
});

test('bytes: as bits, steps of 1000', () => {
    equal(formatBytes(125, {bits: true, perSecond: true}), '1.00 Kbps');
    equal(formatBytes(125000, {bits: true, perSecond: true}), '1.00 Mbps');
});

test('bytes: thousands grouping below the next unit', () => {
    equal(formatBytes(1023 * 1024 - 1, {digits: 0}), '1,023 KiB');
});

test('bytes: largest unit caps', () => {
    equal(formatBytes(2 ** 50, {digits: 0}), '1,024 TiB');
});

test('bytes: bad digits fall back to 2', () => {
    equal(formatBytes(1024, {digits: 42}), '1.00 KiB');
});

test('uptime: default format does not wrap hours without %d', () => {
    equal(formatUptime('%hh %mm', 3000), '0h 50m');
    equal(formatUptime('%hh %mm', 97500), '27h 5m');
    equal(formatUptime('%dd %hh %mm', 97500), '1d 3h 5m');
    equal(formatUptime('up %m:%s, 100%', 125), 'up 2:5, 100%');
});

test('MiB like XFCE: rounded down', () => {
    equal(toMiB(1048576 * 3 - 1), 2);
});

test('netload: average of the last 4, automatic maximum grows and shrinks', () => {
    const h = new RateHistory();
    equal(h.push(4000, null), {average: 1000, fraction: 1000 / 4096});
    equal(h.push(4000, null).average, 2000);
    h.push(4000, null);
    const full = h.push(4000, null);
    equal(full.average, 4000);
    // Grows to the average when above it.
    equal(h.push(10000, null), {average: 5500, fraction: 1});
    // After 20 quiet samples it shrinks by 0.75 steps, never below 1024.
    let last;
    for (let i = 0; i < 60; i++)
        last = h.push(0, null);
    equal(last.average, 0);
    // 5500 × 0.75⁵ ≈ 1305; one more step would go below 1024.
    near(h.push(1024, null).fraction, 256 / (5500 * 0.75 ** 5), 1e-9, 'shrunk maximum');
});

test('netload: fixed maximum', () => {
    const h = new RateHistory();
    equal(h.push(8192, 2048).fraction, 1);
    equal(new RateHistory().push(4096, 2048).fraction, 0.5);
});

done();

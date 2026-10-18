import {parseStat, loadBetween} from '../src/lib/sources/cpu.js';
import {parseMeminfo, memoryUsage} from '../src/lib/sources/memory.js';
import {parseUptime} from '../src/lib/sources/uptime.js';
import {parseNetDev, parseDefaultRoute, isValidDeviceName, NetworkSource, rate}
    from '../src/lib/sources/network.js';
import {test, equal, near, done} from './harness.js';

test('cpu: aggregate line, steal in total, guest not added again', () => {
    // user nice system idle iowait irq softirq steal guest guest_nice
    equal(parseStat('cpu  100 10 50 800 20 5 5 10 30 0\ncpu0 1 2 3 4\n'),
        {busy: 170, total: 1000});
});

test('cpu: old kernels with only four fields', () => {
    equal(parseStat('cpu 1 2 3 4\n'), {busy: 6, total: 10});
});

test('cpu: garbage gives null', () => {
    equal(parseStat('intr 1 2 3\n'), null);
});

test('cpu: load between samples, clamped, no division by zero', () => {
    near(loadBetween({busy: 100, total: 1000}, {busy: 150, total: 1100}), 0.5);
    equal(loadBetween({busy: 100, total: 1000}, {busy: 100, total: 1000}), 0);
    equal(loadBetween({busy: 100, total: 1000}, {busy: 300, total: 1100}), 1);
});

const MEMINFO = `MemTotal:       24306660 kB
MemFree:         1000000 kB
MemAvailable:   17149916 kB
Buffers:          500000 kB
Cached:          6000000 kB
SwapTotal:      18978808 kB
SwapFree:       18000000 kB
HugePages_Total:       0
Hugepagesize:       2048 kB
`;

test('memory: kB fields in bytes, unitless as is', () => {
    const f = parseMeminfo(MEMINFO);
    equal(f.MemTotal, 24306660 * 1024);
    equal(f.HugePages_Total, 0);
});

test('memory: used = total - available', () => {
    const m = memoryUsage(parseMeminfo(MEMINFO));
    equal(m.memUsed, (24306660 - 17149916) * 1024);
    equal(m.swapUsed, (18978808 - 18000000) * 1024);
});

test('memory: no MemAvailable falls back to free + buffers + cached', () => {
    const m = memoryUsage(parseMeminfo(MEMINFO.replace(/^MemAvailable.*\n/m, '')));
    equal(m.memUsed, (24306660 - 1000000 - 500000 - 6000000) * 1024);
});

test('memory: no swap', () => {
    const m = memoryUsage(parseMeminfo('MemTotal: 100 kB\nMemFree: 50 kB\nMemAvailable: 60 kB\n'));
    equal([m.swapTotal, m.swapUsed], [0, 0]);
});

test('uptime', () => {
    equal(parseUptime('235458.96 2572779.18\n'), 235458);
    equal(parseUptime(''), null);
});

const NET_DEV = `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 27513958   21536    0    0    0     0          0         0 27513958   21536    0    0    0     0       0          0
wlp0s20f3:9447643517 58949789    0    0    0     0          0         0 199228339282 13126380    0    0    0     0       0          0
`;

test('network: /proc/net/dev, also with no space after the colon', () => {
    const d = parseNetDev(NET_DEV);
    equal([...d.keys()], ['lo', 'wlp0s20f3']);
    equal(d.get('wlp0s20f3'), {rxBytes: 9447643517, txBytes: 199228339282});
});

const ROUTE = `Iface	Destination	Gateway 	Flags	RefCnt	Use	Metric	Mask		MTU	Window	IRTT
wlp0s20f3	00000000	0102A8C0	0003	0	0	600	00000000	0	0	0
docker0	000011AC	00000000	0001	0	0	0	0000FFFF	0	0	0
enp0s31f6	00000000	0102A8C0	0003	0	0	100	00000000	0	0	0
`;

test('network: default route with the lowest metric', () => {
    equal(parseDefaultRoute(ROUTE), 'enp0s31f6');
    equal(parseDefaultRoute(ROUTE.split('\n').slice(0, 3).join('\n')), 'wlp0s20f3');
    equal(parseDefaultRoute(ROUTE.split('\n')[0]), null);
});

test('network: only a real default route: mask 0, with a device', () => {
    const vpn = `Iface\tDestination\tGateway\tFlags\tRefCnt\tUse\tMetric\tMask\tMTU\tWindow\tIRTT
tun0\t00000000\t0101080A\t0003\t0\t0\t0\t00000080\t0\t0\t0
*\t00000000\t00000000\t0201\t0\t0\t0\t00000000\t0\t0\t0
wlp0s20f3\t00000000\t0102A8C0\t0003\t0\t0\t600\t00000000\t0\t0\t0
`;
    equal(parseDefaultRoute(vpn), 'wlp0s20f3');
});

test('network: device names that could escape /sys/class/net are rejected', () => {
    equal(['eth0', 'wlp0s20f3', 'br-1a2b', '..', '.', 'a/b', '', 'x y', 'averyveryverylongname']
        .map(isValidDeviceName), [true, true, true, false, false, false, false, false, false]);
});

test('network: rates, totals, first sample primes, counter reset counts from zero', () => {
    const s = new NetworkSource('eth0');
    equal(s.update({rxBytes: 1000, txBytes: 0}, 0), {});
    equal(s.update({rxBytes: 3000, txBytes: 500}, 500000), {rx: 4000, tx: 1000, rxTotal: 2000, txTotal: 500});
    equal(s.update({rxBytes: 100, txBytes: 500}, 1000000), {rx: 200, tx: 0, rxTotal: 2100, txTotal: 500});
    equal(rate(10, 5, 1), 5);
});

done();

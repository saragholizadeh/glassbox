import Pyroscope from '@pyroscope/nodejs';

/**
 * Starts the profiler for one service. It sends to Pyroscope (localhost:4040)
 * which functions were running, about 100 times a second.
 * You see it in Grafana as a flame graph.
 */
export function startProfiling(serviceName: string): void {
  Pyroscope.init({
    serverAddress: process.env.PYROSCOPE_URL ?? 'http://localhost:4040',
    appName: serviceName,
    // Also record CPU time, not only "which function was on the stack".
    wall: { collectCpuTime: true },
  });
  Pyroscope.start();
}

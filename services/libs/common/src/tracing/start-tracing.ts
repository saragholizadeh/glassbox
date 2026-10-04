import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

/**
 * Starts OpenTelemetry for one service.
 *
 * It must run before Nest is loaded. If Nest loads first, you get no spans
 * and no error. So: import only OTel packages here, and import this file on
 * the first line of main.ts.
 */
export function startTracing(serviceName: string): void {
  const sdk = new NodeSDK({
    // The name you see in Grafana.
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: process.env.SERVICE_VERSION ?? '0.1.0',
    }),

    // Sends spans to the OTel Collector at localhost:4318.
    traceExporter: new OTLPTraceExporter(),

    instrumentations: [
      getNodeAutoInstrumentations({
        // Don't trace health checks.
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req) => (req.url ?? '').startsWith('/health'),
        },

        // Too noisy: a span for every file read and network call.
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },

        // Add trace_id to every log line. Logs still go to Loki through the
        // log files, so don't send them a second time.
        '@opentelemetry/instrumentation-pino': { disableLogSending: true },
        '@opentelemetry/instrumentation-winston': { disableLogSending: true },
      }),
    ],
  });

  sdk.start();

  // Send the last spans before the app stops.
  const shutdown = () => {
    sdk.shutdown().catch(() => undefined);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

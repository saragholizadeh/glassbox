/**
 * The identity a service reports about itself.
 *
 * `name` matters more than it looks: in step 3 it becomes the OpenTelemetry
 * `service.name` resource attribute, which is how Tempo, Prometheus and Loki
 * all decide which service a piece of telemetry came from. Keep these three
 * names stable and identical everywhere.
 */
export interface ServiceInfo {
  name: string;
  version: string;
  port: number;
  env: string;
}

export function readServiceInfo(name: string, defaultPort: number): ServiceInfo {
  const portVar = `${name.toUpperCase().replace(/-/g, '_')}_PORT`;

  return {
    name,
    version: process.env.SERVICE_VERSION ?? '0.1.0',
    port: Number(process.env[portVar] ?? defaultPort),
    env: process.env.NODE_ENV ?? 'development',
  };
}

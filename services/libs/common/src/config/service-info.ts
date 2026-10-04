/** Basic facts a service knows about itself. */
export interface ServiceInfo {
  name: string;
  version: string;
  port: number;
  env: string;
}

/**
 * Reads the service's port from the environment, e.g. ORDERS_SERVICE_PORT,
 * or uses the default.
 */
export function readServiceInfo(name: string, defaultPort: number): ServiceInfo {
  const portVar = `${name.toUpperCase().replace(/-/g, '_')}_PORT`;

  return {
    name,
    version: process.env.SERVICE_VERSION ?? '0.1.0',
    port: Number(process.env[portVar] ?? defaultPort),
    env: process.env.NODE_ENV ?? 'development',
  };
}

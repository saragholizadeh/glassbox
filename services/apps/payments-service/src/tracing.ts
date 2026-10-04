// Starts OpenTelemetry. main.ts imports this on its FIRST line.
// Import from the file directly, not from '@app/common' — that would load Nest too early.
import { startTracing } from '@app/common/tracing/start-tracing';
import { SERVICE_NAME } from './constants';

startTracing(SERVICE_NAME);

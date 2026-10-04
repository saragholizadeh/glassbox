// Starts OpenTelemetry. main.ts imports this on its FIRST line.
// Import from the file directly, not from '@app/common' — that would load Nest too early.
import { startOtel } from '@app/common/otel/start-otel';
import { SERVICE_NAME } from './constants';

startOtel(SERVICE_NAME);

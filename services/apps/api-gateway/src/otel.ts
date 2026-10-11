// Starts OpenTelemetry and the profiler. main.ts imports this on its FIRST line.
// Import from the files directly, not from '@app/common' — that would load Nest too early.
import { startOtel } from '@app/common/otel/start-otel';
import { startProfiling } from '@app/common/profiling/start-profiling';
import { SERVICE_NAME } from './constants';

startOtel(SERVICE_NAME);
startProfiling(SERVICE_NAME);

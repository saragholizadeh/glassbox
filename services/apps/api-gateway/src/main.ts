// Must stay the first import. See tracing.ts.
import './tracing';

import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { readServiceInfo } from '@app/common';
import { AppModule } from './app.module';
import { SERVICE_NAME, DEFAULT_PORT } from './constants';

async function bootstrap(): Promise<void> {
  const info = readServiceInfo(SERVICE_NAME, DEFAULT_PORT);

  // bufferLogs: keep startup logs until our logger is ready, so they are JSON too.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use Pino for all Nest logs.
  app.useLogger(app.get(PinoLogger));

  // Run cleanup code when the app is stopped.
  app.enableShutdownHooks();
  await app.listen(info.port);

  app
    .get(PinoLogger)
    .log(`${info.name} v${info.version} listening on http://localhost:${info.port}`);
}

void bootstrap();

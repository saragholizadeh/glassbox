// Must stay the first import. See tracing.ts.
import './tracing';

import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import type { LoggerService } from '@nestjs/common';
import { readServiceInfo } from '@app/common';
import { AppModule } from './app.module';
import { SERVICE_NAME, DEFAULT_PORT } from './constants';

async function bootstrap(): Promise<void> {
  const info = readServiceInfo(SERVICE_NAME, DEFAULT_PORT);

  // bufferLogs: keep startup logs until our logger is ready, so they are JSON too.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use Winston for all Nest logs.
  const logger = app.get<LoggerService>(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  // Run cleanup code when the app is stopped.
  app.enableShutdownHooks();
  await app.listen(info.port);

  logger.log(
    `${info.name} v${info.version} listening on http://localhost:${info.port}`,
    'Bootstrap',
  );
}

void bootstrap();

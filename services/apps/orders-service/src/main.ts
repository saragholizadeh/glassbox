import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import type { LoggerService } from '@nestjs/common';
import { readServiceInfo } from '@app/common';
import { AppModule } from './app.module';
import { SERVICE_NAME, DEFAULT_PORT } from './constants';

async function bootstrap(): Promise<void> {
  const info = readServiceInfo(SERVICE_NAME, DEFAULT_PORT);

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Same idea as the gateway's Pino line, different provider token: replace
  // Nest's built-in logger so every framework and application log line goes
  // through Winston.
  const logger = app.get<LoggerService>(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  app.enableShutdownHooks();
  await app.listen(info.port);

  logger.log(
    `${info.name} v${info.version} listening on http://localhost:${info.port}`,
    'Bootstrap',
  );
}

void bootstrap();

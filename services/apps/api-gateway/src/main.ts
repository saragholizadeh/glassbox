import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { readServiceInfo } from '@app/common';
import { AppModule } from './app.module';
import { SERVICE_NAME, DEFAULT_PORT } from './constants';

async function bootstrap(): Promise<void> {
  const info = readServiceInfo(SERVICE_NAME, DEFAULT_PORT);

  // `bufferLogs` holds back anything logged during startup until our own
  // logger is ready, so those early lines come out structured too instead of
  // in Nest's default format.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Replaces Nest's built-in logger everywhere. From here on, every
  // `new Logger(...)` inside Nest — and inside your own code — writes
  // structured JSON through Pino.
  app.useLogger(app.get(PinoLogger));

  app.enableShutdownHooks();
  await app.listen(info.port);

  app
    .get(PinoLogger)
    .log(`${info.name} v${info.version} listening on http://localhost:${info.port}`);
}

void bootstrap();

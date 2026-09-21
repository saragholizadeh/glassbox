import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { readServiceInfo } from '@app/common';
import { AppModule } from './app.module';
import { SERVICE_NAME, DEFAULT_PORT } from './constants';

async function bootstrap(): Promise<void> {
  const info = readServiceInfo(SERVICE_NAME, DEFAULT_PORT);

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  app.enableShutdownHooks();
  await app.listen(info.port);

  app
    .get(PinoLogger)
    .log(`${info.name} v${info.version} listening on http://localhost:${info.port}`);
}

void bootstrap();

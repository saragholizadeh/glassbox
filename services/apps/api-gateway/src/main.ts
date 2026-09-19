import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { readServiceInfo } from '@app/common';
import { AppModule } from './app.module';
import { SERVICE_NAME, DEFAULT_PORT } from './constants';

async function bootstrap(): Promise<void> {
  const info = readServiceInfo(SERVICE_NAME, DEFAULT_PORT);
  const app = await NestFactory.create(AppModule);

  // Lets Nest run onModuleDestroy / onApplicationShutdown on SIGTERM.
  //
  // Step 3 hangs the OpenTelemetry flush off this. Without it, the spans still
  // sitting in memory when the container is killed are lost — which are
  // exactly the spans from the requests that were failing.
  app.enableShutdownHooks();

  await app.listen(info.port);

  Logger.log(
    `${info.name} v${info.version} listening on http://localhost:${info.port}`,
    'Bootstrap',
  );
}

void bootstrap();

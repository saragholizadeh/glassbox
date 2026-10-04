import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule, LoggingModule } from '@app/common';
import { AppController } from './app.controller';
import { SERVICE_NAME } from './constants';
import { OrderEventsService } from './order-events.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    // Winston here, Pino in the other two, so we can compare them.
    LoggingModule.forRoot({ serviceName: SERVICE_NAME, driver: 'winston' }),
    HealthModule,
  ],
  controllers: [AppController],
  providers: [OrderEventsService],
})
export class AppModule {}

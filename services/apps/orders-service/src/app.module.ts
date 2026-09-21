import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule, LoggingModule } from '@app/common';
import { AppController } from './app.controller';
import { SERVICE_NAME } from './constants';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    // The odd one out, on purpose. Same output shape as the other two, built
    // from a different library, so the two can be compared honestly.
    LoggingModule.forRoot({ serviceName: SERVICE_NAME, driver: 'winston' }),
    HealthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule, LoggingModule } from '@app/common';
import { AppController } from './app.controller';
import { SERVICE_NAME } from './constants';
import { PaymentsConsumer } from './payments.consumer';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    LoggingModule.forRoot({ serviceName: SERVICE_NAME }),
    HealthModule,
  ],
  controllers: [AppController],
  providers: [PaymentsConsumer],
})
export class AppModule {}

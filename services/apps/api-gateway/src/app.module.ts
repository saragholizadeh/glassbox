import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule, LoggingModule } from '@app/common';
import { AppController } from './app.controller';
import { CheckoutService } from './checkout.service';
import { SERVICE_NAME } from './constants';

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
  providers: [CheckoutService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from '@app/common';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // One .env at the repo root, shared by all three services.
      envFilePath: ['../.env', '.env'],
    }),
    HealthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

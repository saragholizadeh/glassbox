import { Module, Scope } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { bugOn, HealthModule, LoggingModule } from '@app/common';
import { AppController } from './app.controller';
import { SERVICE_NAME } from './constants';
import { DbService } from './db.service';
import { OrderEventsService } from './order-events.service';
import { OrdersService } from './orders.service';
import { ProductsService } from './products.service';

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
  providers: [
    DbService,
    {
      provide: ProductsService,
      useClass: ProductsService,
      // BUG 3 (see README). Scope.REQUEST: Nest makes a new ProductsService
      // for every request. (This works here because `imports` above already loaded .env.)
      scope: bugOn('request-scope') ? Scope.REQUEST : Scope.DEFAULT,
    },
    OrdersService,
    OrderEventsService,
  ],
})
export class AppModule {}

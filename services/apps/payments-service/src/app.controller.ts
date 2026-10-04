import { Controller, Get } from '@nestjs/common';
import { ORDER_CREATED_TOPIC } from '@app/common';
import { SERVICE_NAME } from './constants';

@Controller()
export class AppController {
  @Get()
  info() {
    return {
      service: SERVICE_NAME,
      role: 'Reads order.created from Kafka and charges the order (fake).',
      consumes: ORDER_CREATED_TOPIC,
      endpoints: ['GET /', 'GET /health/live', 'GET /health/ready'],
    };
  }
}

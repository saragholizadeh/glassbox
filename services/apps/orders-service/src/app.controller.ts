import { Controller, Get } from '@nestjs/common';
import { SERVICE_NAME } from './constants';

@Controller()
export class AppController {
  @Get()
  info() {
    return {
      service: SERVICE_NAME,
      role: 'Owns orders. Reads Postgres and Redis, publishes order.created to Kafka.',
      endpoints: ['GET /', 'GET /health/live', 'GET /health/ready'],
      wiredUpIn: {
        postgresAndRedis: 'step 4',
        kafkaProducer: 'step 4',
      },
    };
  }
}

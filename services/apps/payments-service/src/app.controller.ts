import { Controller, Get } from '@nestjs/common';
import { SERVICE_NAME } from './constants';

@Controller()
export class AppController {
  @Get()
  info() {
    return {
      service: SERVICE_NAME,
      role: 'Consumes order.created from Kafka and calls the (fake) payment provider.',
      endpoints: ['GET /', 'GET /health/live', 'GET /health/ready'],
      wiredUpIn: {
        kafkaConsumer: 'step 4',
        traceContextFromKafkaHeaders: 'step 4 — the hard part',
      },
    };
  }
}

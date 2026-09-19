import { Controller, Get, Post } from '@nestjs/common';
import { SERVICE_NAME } from './constants';

@Controller()
export class AppController {
  @Get()
  info() {
    return {
      service: SERVICE_NAME,
      role: 'Public entry point. Receives the checkout request and calls orders-service.',
      endpoints: ['GET /', 'POST /checkout', 'GET /health/live', 'GET /health/ready'],
    };
  }

  /**
   * The request every diagram in the project follows.
   *
   * Right now it returns a stub. Step 4 makes it call orders-service over
   * HTTP, which is where a trace first crosses a service boundary.
   */
  @Post('checkout')
  checkout() {
    return {
      status: 'stub',
      note: 'Wired to orders-service in step 4 — see docs/step-04-propagation.md',
    };
  }
}

import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  /**
   * "Is the app alive?" If this fails, the app is restarted.
   *
   * Never check the database here. If the database is slow, every app
   * would restart at the same time.
   */
  @Get('live')
  live() {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  /**
   * "Can the app take traffic?" If this fails, traffic stops but the app
   * keeps running. Checking dependencies here is fine.
   */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([() => this.memory.checkHeap('heap', 512 * 1024 * 1024)]);
  }
}

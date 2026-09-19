import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  /**
   * Liveness — "is this process alive?"
   *
   * An orchestrator restarts the container when this fails, so it must never
   * check a dependency. If Postgres is slow and you check it here, every
   * instance gets killed at the same moment and you turn a slow database into
   * a total outage.
   */
  @Get('live')
  live() {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  /**
   * Readiness — "should traffic be sent here?"
   *
   * This one may check dependencies. Failing it pulls the instance out of the
   * load balancer without killing it, so it can recover on its own.
   *
   * Step 4 adds Postgres, Redis and Kafka indicators to this list.
   */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([() => this.memory.checkHeap('heap', 512 * 1024 * 1024)]);
  }
}

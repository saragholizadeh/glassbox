import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

/** Adds GET /health/live and GET /health/ready to a service. */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}

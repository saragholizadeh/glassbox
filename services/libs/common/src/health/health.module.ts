import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

/**
 * Imported by all three services so they expose the same two endpoints:
 *   GET /health/live   — is the process alive?
 *   GET /health/ready  — should it receive traffic?
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}

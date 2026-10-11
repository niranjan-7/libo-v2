import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthResponse } from '@library/contracts';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth(): Promise<HealthResponse> {
    return this.healthService.checkHealth();
  }

  @Get('ready')
  async getReadiness(): Promise<{ ready: boolean }> {
    const health = await this.healthService.checkHealth();
    return { ready: health.database.controlPlane === 'connected' };
  }

  @Get('live')
  getLiveness(): { live: boolean; uptime: number } {
    return {
      live: true,
      uptime: process.uptime(),
    };
  }
}

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthResponse } from '@library/contracts';

@Injectable()
export class HealthService {
  constructor(private readonly controlPlaneDataSource: DataSource) {}

  async checkHealth(): Promise<HealthResponse> {
    const startTime = Date.now();
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';
    let latencyMs: number | undefined;
    let message: string | undefined;

    try {
      if (this.controlPlaneDataSource.isInitialized) {
        await this.controlPlaneDataSource.query('SELECT 1');
        latencyMs = Date.now() - startTime;
        dbStatus = 'connected';
      } else {
        message = 'DataSource is not initialized';
      }
    } catch (err: any) {
      dbStatus = 'disconnected';
      message = err?.message || 'Database connection error';
    }

    return {
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '0.1.0',
      database: {
        controlPlane: dbStatus,
        latencyMs,
        message,
      },
    };
  }
}

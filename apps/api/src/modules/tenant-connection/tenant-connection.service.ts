import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

export interface TenantConnectionConfig {
  organizationId: string;
  databaseKey: string;
  host: string;
  port: number;
  databaseName: string;
  username?: string;
  password?: string;
}

@Injectable()
export class TenantConnectionService implements OnApplicationShutdown {
  private readonly logger = new Logger(TenantConnectionService.name);
  private readonly tenantPools = new Map<string, DataSource>();

  constructor(private readonly configService: ConfigService) {}

  /**
   * Retrieves or initializes a DataSource for a specific tenant organization
   */
  async getTenantDataSource(config: TenantConnectionConfig): Promise<DataSource> {
    const existingPool = this.tenantPools.get(config.organizationId);
    if (existingPool && existingPool.isInitialized) {
      return existingPool;
    }

    this.logger.log(`Initializing tenant database pool for org: ${config.organizationId} (${config.databaseName})`);

    const tenantDataSource = new DataSource({
      type: 'postgres',
      host: config.host || this.configService.get<string>('TENANT_DB_HOST', 'localhost'),
      port: config.port || Number(this.configService.get<number>('TENANT_DB_PORT', 5432)),
      username: config.username || this.configService.get<string>('TENANT_DB_USER', 'postgres'),
      password: config.password || this.configService.get<string>('TENANT_DB_PASSWORD', 'postgres'),
      database: config.databaseName,
      entities: [], // Populated as tenant modules are registered in Milestone 2
      migrations: [],
      synchronize: false,
      logging: false,
      extra: {
        min: 1,
        max: 10,
        idleTimeoutMillis: 600000, // 10 minutes idle eviction
      },
    });

    await tenantDataSource.initialize();
    this.tenantPools.set(config.organizationId, tenantDataSource);
    return tenantDataSource;
  }

  /**
   * Gracefully destroys and evicts an idle tenant connection pool
   */
  async evictTenantPool(organizationId: string): Promise<void> {
    const pool = this.tenantPools.get(organizationId);
    if (pool) {
      if (pool.isInitialized) {
        await pool.destroy();
      }
      this.tenantPools.delete(organizationId);
      this.logger.log(`Evicted tenant pool for org: ${organizationId}`);
    }
  }

  /**
   * Shuts down all active tenant pools on application termination
   */
  async onApplicationShutdown(): Promise<void> {
    this.logger.log(`Draining ${this.tenantPools.size} active tenant database pools...`);
    for (const [orgId, pool] of this.tenantPools.entries()) {
      try {
        if (pool.isInitialized) {
          await pool.destroy();
        }
      } catch (err: any) {
        this.logger.error(`Error closing pool for org ${orgId}: ${err?.message}`);
      }
    }
    this.tenantPools.clear();
  }
}

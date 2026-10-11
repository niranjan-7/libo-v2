import { Injectable, Logger, NotFoundException, UnauthorizedException, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { TenantDatabaseRegistryService } from '../control-plane/tenant-database-registry.service';
import { InitialTenantSchema1700000000001 } from '../../database/tenant/migrations/1700000000001-InitialTenantSchema';

@Injectable()
export class TenantConnectionService implements OnApplicationShutdown {
  private readonly logger = new Logger(TenantConnectionService.name);
  private readonly tenantPools = new Map<string, { dataSource: DataSource; lastAccessed: number }>();
  private readonly MAX_POOLS = 50;
  private readonly IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly registryService: TenantDatabaseRegistryService,
  ) {}

  /**
   * Resolves a tenant DataSource safely using organization ID.
   * Never accepts raw database names or connection strings from the client.
   */
  async getTenantConnection(organizationId: string): Promise<DataSource> {
    const now = Date.now();
    const existing = this.tenantPools.get(organizationId);

    if (existing && existing.dataSource.isInitialized) {
      existing.lastAccessed = now;
      return existing.dataSource;
    }

    // 1. Verify organization registry status in Control Plane
    const registry = await this.registryService.getRegistryEntry(organizationId);
    if (!registry) {
      throw new NotFoundException(`No tenant database found for organization ${organizationId}`);
    }

    if (registry.status !== 'HEALTHY') {
      throw new UnauthorizedException(`Tenant database for organization ${organizationId} is currently ${registry.status}`);
    }

    // 2. Enforce LRU cache boundary
    if (this.tenantPools.size >= this.MAX_POOLS) {
      await this.evictOldestPool();
    }

    this.logger.log(`Opening pooled connection for tenant database: ${registry.database_name}`);

    // 3. Connect to isolated tenant database
    const dataSource = new DataSource({
      type: 'postgres',
      host: registry.host,
      port: registry.port,
      username: this.configService.get<string>('TENANT_DB_USER', 'postgres'),
      password: this.configService.get<string>('TENANT_DB_PASSWORD', 'postgres'),
      database: registry.database_name,
      migrations: [InitialTenantSchema1700000000001],
      synchronize: false, // Strict requirement: no synchronize in production
      logging: false,
      extra: {
        min: 1,
        max: 10,
        idleTimeoutMillis: this.IDLE_TIMEOUT_MS,
      },
    });

    await dataSource.initialize();
    this.tenantPools.set(organizationId, { dataSource, lastAccessed: now });
    return dataSource;
  }

  /**
   * Evicts the least-recently-accessed tenant database pool
   */
  private async evictOldestPool(): Promise<void> {
    let oldestOrgId: string | null = null;
    let oldestTime = Infinity;

    for (const [orgId, entry] of this.tenantPools.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestOrgId = orgId;
      }
    }

    if (oldestOrgId) {
      await this.closeTenantPool(oldestOrgId);
    }
  }

  /**
   * Gracefully shuts down and removes an active tenant connection pool
   */
  async closeTenantPool(organizationId: string): Promise<void> {
    const entry = this.tenantPools.get(organizationId);
    if (entry) {
      if (entry.dataSource.isInitialized) {
        await entry.dataSource.destroy();
      }
      this.tenantPools.delete(organizationId);
      this.logger.log(`Closed tenant connection pool for org: ${organizationId}`);
    }
  }

  /**
   * Shuts down all active tenant pools on application shutdown
   */
  async onApplicationShutdown(): Promise<void> {
    this.logger.log(`Closing ${this.tenantPools.size} active tenant pools...`);
    for (const [orgId, entry] of this.tenantPools.entries()) {
      try {
        if (entry.dataSource.isInitialized) {
          await entry.dataSource.destroy();
        }
      } catch (err: any) {
        this.logger.error(`Error destroying pool for org ${orgId}: ${err?.message}`);
      }
    }
    this.tenantPools.clear();
  }
}

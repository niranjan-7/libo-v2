import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { TenantDatabaseRegistryEntity } from '../../database/control-plane/entities/tenant-registry.entity';
import { InitialTenantSchema1700000000001 } from '../../database/tenant/migrations/1700000000001-InitialTenantSchema';

@Injectable()
export class TenantDatabaseRegistryService {
  private readonly logger = new Logger(TenantDatabaseRegistryService.name);

  constructor(
    @InjectRepository(TenantDatabaseRegistryEntity)
    private readonly registryRepo: Repository<TenantDatabaseRegistryEntity>,
    private readonly controlPlaneDataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Retrieves tenant database routing entry by organization ID
   */
  async getRegistryEntry(organizationId: string): Promise<TenantDatabaseRegistryEntity | null> {
    return this.registryRepo.findOne({ where: { organization_id: organizationId } });
  }

  /**
   * Safely provisions a new isolated PostgreSQL tenant database
   * Never accepts raw database names from the client.
   */
  async provisionTenantDatabase(organizationId: string, slug: string): Promise<TenantDatabaseRegistryEntity> {
    const existing = await this.getRegistryEntry(organizationId);
    if (existing) {
      throw new ConflictException(`Tenant database already provisioned for organization ${organizationId}`);
    }

    // Generate safe, sanitized database name
    const sanitizedSlug = slug.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 30);
    const idPrefix = organizationId.replace(/-/g, '').slice(0, 8);
    const databaseName = `tenant_${sanitizedSlug}_${idPrefix}`;
    const databaseKey = `key_${sanitizedSlug}_${idPrefix}`;

    this.logger.log(`Provisioning PostgreSQL database: ${databaseName} for org: ${organizationId}`);

    // 1. Create database in PostgreSQL management instance
    // Note: Database name is strictly validated alphanumeric string
    await this.controlPlaneDataSource.query(`CREATE DATABASE "${databaseName}"`);

    // 2. Connect to the newly created database and run tenant migrations
    const host = this.configService.get<string>('TENANT_DB_HOST', 'localhost');
    const port = Number(this.configService.get<number>('TENANT_DB_PORT', 5432));
    const username = this.configService.get<string>('TENANT_DB_USER', 'postgres');
    const password = this.configService.get<string>('TENANT_DB_PASSWORD', 'postgres');

    const tempDataSource = new DataSource({
      type: 'postgres',
      host,
      port,
      username,
      password,
      database: databaseName,
      migrations: [InitialTenantSchema1700000000001],
      synchronize: false,
      logging: false,
    });

    try {
      await tempDataSource.initialize();
      this.logger.log(`Running initial tenant schema migrations for ${databaseName}...`);
      await tempDataSource.runMigrations();
      this.logger.log(`Tenant migrations successfully applied to ${databaseName}`);
    } catch (err: any) {
      this.logger.error(`Error migrating new tenant DB ${databaseName}: ${err?.message}`);
      throw err;
    } finally {
      if (tempDataSource.isInitialized) {
        await tempDataSource.destroy();
      }
    }

    // 3. Register the new tenant database in TenantDatabaseRegistry
    const registryEntry = this.registryRepo.create({
      organization_id: organizationId,
      database_key: databaseKey,
      host,
      port,
      database_name: databaseName,
      secret_reference: 'env:TENANT_DB_PASSWORD',
      schema_version: '1.0.0',
      status: 'HEALTHY',
    });

    return this.registryRepo.save(registryEntry);
  }

  /**
   * Programmatically applies tenant migrations to a specific organization tenant DB
   */
  async runTenantMigrations(organizationId: string): Promise<void> {
    const registry = await this.getRegistryEntry(organizationId);
    if (!registry) {
      throw new NotFoundException(`No tenant database registry found for org ${organizationId}`);
    }

    const tenantDataSource = new DataSource({
      type: 'postgres',
      host: registry.host,
      port: registry.port,
      username: this.configService.get<string>('TENANT_DB_USER', 'postgres'),
      password: this.configService.get<string>('TENANT_DB_PASSWORD', 'postgres'),
      database: registry.database_name,
      migrations: [InitialTenantSchema1700000000001],
      synchronize: false,
      logging: false,
    });

    try {
      await tenantDataSource.initialize();
      const applied = await tenantDataSource.runMigrations();
      this.logger.log(`Applied ${applied.length} migration(s) to tenant database ${registry.database_name}`);
      registry.schema_version = '1.0.0';
      await this.registryRepo.save(registry);
    } finally {
      if (tenantDataSource.isInitialized) {
        await tenantDataSource.destroy();
      }
    }
  }

  /**
   * Applies migrations across all registered healthy tenant databases
   */
  async runMigrationsForAllTenants(): Promise<Array<{ organizationId: string; status: 'ok' | 'failed'; error?: string }>> {
    const tenants = await this.registryRepo.find({ where: { status: 'HEALTHY' } });
    const results: Array<{ organizationId: string; status: 'ok' | 'failed'; error?: string }> = [];

    for (const tenant of tenants) {
      try {
        await this.runTenantMigrations(tenant.organization_id);
        results.push({ organizationId: tenant.organization_id, status: 'ok' });
      } catch (err: any) {
        results.push({ organizationId: tenant.organization_id, status: 'failed', error: err?.message });
      }
    }

    return results;
  }
}

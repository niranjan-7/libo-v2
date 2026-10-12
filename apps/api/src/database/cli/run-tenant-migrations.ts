import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { UserEntity } from '../control-plane/entities/user.entity';
import { OrganizationEntity } from '../control-plane/entities/organization.entity';
import { OrgMembershipEntity } from '../control-plane/entities/org-membership.entity';
import { OrgInvitationEntity } from '../control-plane/entities/org-invitation.entity';
import { TenantDatabaseRegistryEntity } from '../control-plane/entities/tenant-registry.entity';
import { ControlPlaneAuditLogEntity } from '../control-plane/entities/control-plane-audit.entity';
import { InitialTenantSchema1700000000001 } from '../tenant/migrations/1700000000001-InitialTenantSchema';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

async function run() {
  const targetOrgId = process.argv[2]; // Optional specific organization ID

  console.log('Connecting to Control-Plane to discover tenant fleet...');
  const controlPlaneDs = new DataSource({
    type: 'postgres',
    host: process.env.CONTROL_PLANE_DB_HOST || 'localhost',
    port: Number(process.env.CONTROL_PLANE_DB_PORT || 5432),
    username: process.env.CONTROL_PLANE_DB_USER || 'postgres',
    password: process.env.CONTROL_PLANE_DB_PASSWORD || 'postgres',
    database: process.env.CONTROL_PLANE_DB_NAME || 'control_plane_db',
    entities: [
      UserEntity,
      OrganizationEntity,
      OrgMembershipEntity,
      OrgInvitationEntity,
      TenantDatabaseRegistryEntity,
      ControlPlaneAuditLogEntity,
    ],
    synchronize: false,
    logging: false,
  });

  await controlPlaneDs.initialize();

  const registryRepo = controlPlaneDs.getRepository(TenantDatabaseRegistryEntity);
  const tenants = targetOrgId
    ? await registryRepo.find({ where: { organization_id: targetOrgId } })
    : await registryRepo.find({ where: { status: 'HEALTHY' } });

  console.log(`Discovered ${tenants.length} tenant database(s) to inspect/migrate.`);

  let successCount = 0;
  let failCount = 0;

  for (const tenant of tenants) {
    console.log(`Migrating tenant '${tenant.database_name}' (org: ${tenant.organization_id})...`);
    const tenantDs = new DataSource({
      type: 'postgres',
      host: tenant.host || process.env.TENANT_DB_HOST || 'localhost',
      port: tenant.port || Number(process.env.TENANT_DB_PORT || 5432),
      username: process.env.TENANT_DB_USER || 'postgres',
      password: process.env.TENANT_DB_PASSWORD || 'postgres',
      database: tenant.database_name,
      migrations: [InitialTenantSchema1700000000001],
      synchronize: false,
      logging: false,
    });

    try {
      await tenantDs.initialize();
      const applied = await tenantDs.runMigrations();
      console.log(`  -> Applied ${applied.length} migration(s) successfully to ${tenant.database_name}`);
      successCount++;
    } catch (err: any) {
      console.error(`  -> Failed migrating ${tenant.database_name}:`, err.message);
      failCount++;
    } finally {
      if (tenantDs.isInitialized) {
        await tenantDs.destroy();
      }
    }
  }

  await controlPlaneDs.destroy();
  console.log(`\nTenant migration complete. Success: ${successCount}, Failed: ${failCount}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal tenant migration runner error:', err);
  process.exit(1);
});

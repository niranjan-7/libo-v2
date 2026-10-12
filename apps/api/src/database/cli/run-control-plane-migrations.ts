import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { UserEntity } from '../control-plane/entities/user.entity';
import { OrganizationEntity } from '../control-plane/entities/organization.entity';
import { OrgMembershipEntity } from '../control-plane/entities/org-membership.entity';
import { OrgInvitationEntity } from '../control-plane/entities/org-invitation.entity';
import { TenantDatabaseRegistryEntity } from '../control-plane/entities/tenant-registry.entity';
import { ControlPlaneAuditLogEntity } from '../control-plane/entities/control-plane-audit.entity';
import { InitialControlPlane1700000000000 } from '../control-plane/migrations/1700000000000-InitialControlPlane';
import { AddUserDisplayName1700000000002 } from '../control-plane/migrations/1700000000002-AddUserDisplayName';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

async function run() {
  console.log('Connecting to Control-Plane database for migrations...');
  const dataSource = new DataSource({
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
    migrations: [InitialControlPlane1700000000000, AddUserDisplayName1700000000002],
    synchronize: false,
    logging: true,
  });

  try {
    await dataSource.initialize();
    console.log('Running Control-Plane migrations...');
    const applied = await dataSource.runMigrations();
    console.log(`Successfully applied ${applied.length} migration(s):`);
    applied.forEach((m) => console.log(` - ${m.name}`));
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

run();

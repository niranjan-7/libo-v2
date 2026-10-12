import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { UserEntity } from '../control-plane/entities/user.entity';
import { OrganizationEntity } from '../control-plane/entities/organization.entity';
import { OrgMembershipEntity } from '../control-plane/entities/org-membership.entity';
import { OrgInvitationEntity } from '../control-plane/entities/org-invitation.entity';
import { TenantDatabaseRegistryEntity } from '../control-plane/entities/tenant-registry.entity';
import { ControlPlaneAuditLogEntity } from '../control-plane/entities/control-plane-audit.entity';
import { TenantDatabaseRegistryService } from '../../modules/control-plane/tenant-database-registry.service';
import { TenantConnectionService } from '../../modules/tenant-connection/tenant-connection.service';
import { AuthService } from '../../modules/auth/auth.service';
import { OrganizationsService } from '../../modules/organizations/organizations.service';
import { CatalogService } from '../../modules/catalog/catalog.service';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

async function seed() {
  console.log('Checking demo seed state...');
  const configService = new ConfigService(process.env);
  const controlPlaneDs = new DataSource({
    type: 'postgres',
    host: configService.get<string>('CONTROL_PLANE_DB_HOST', 'localhost'),
    port: Number(configService.get<number>('CONTROL_PLANE_DB_PORT', 5432)),
    username: configService.get<string>('CONTROL_PLANE_DB_USER', 'postgres'),
    password: configService.get<string>('CONTROL_PLANE_DB_PASSWORD', 'postgres'),
    database: configService.get<string>('CONTROL_PLANE_DB_NAME', 'control_plane_db'),
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

  const userRepo = controlPlaneDs.getRepository(UserEntity);
  const existingUser = await userRepo.findOne({ where: { email: 'admin@library.test' } });

  if (existingUser) {
    console.log('Demo user already exists (admin@library.test). Skipping seed.');
    await controlPlaneDs.destroy();
    return;
  }

  const orgRepo = controlPlaneDs.getRepository(OrganizationEntity);
  const membershipRepo = controlPlaneDs.getRepository(OrgMembershipEntity);
  const inviteRepo = controlPlaneDs.getRepository(OrgInvitationEntity);
  const registryRepo = controlPlaneDs.getRepository(TenantDatabaseRegistryEntity);
  const auditRepo = controlPlaneDs.getRepository(ControlPlaneAuditLogEntity);

  const registryService = new TenantDatabaseRegistryService(registryRepo, controlPlaneDs, configService);
  const connectionService = new TenantConnectionService(configService, registryService);
  const authService = new AuthService(userRepo, membershipRepo, configService);
  const orgsService = new OrganizationsService(
    orgRepo,
    membershipRepo,
    inviteRepo,
    userRepo,
    auditRepo,
    registryService,
    connectionService,
  );
  const catalogService = new CatalogService(connectionService);

  console.log('Creating demo admin user...');
  const regResult = await authService.register({
    email: 'admin@library.test',
    password: 'Password123!',
    displayName: 'Eleanor Vance (Head Librarian)',
  });

  const userId = regResult.user.userId;

  console.log('Creating demo organization & provisioning tenant database...');
  const orgResult = await orgsService.createOrganization(userId, {
    name: 'Apex Central University',
    slug: 'apex-central',
    initialLibraryName: 'Main Campus Library',
  });

  const orgId = orgResult.organization.organizationId;
  const libraryId = orgResult.libraries[0].libraryId;

  console.log('Seeding initial catalog, inventory, and floor layout...');
  await catalogService.seedLibrary(orgId, libraryId);

  await connectionService.onApplicationShutdown();
  await controlPlaneDs.destroy();

  console.log('\nDemo seed successful!');
  console.log('Login credentials:');
  console.log('  Email:    admin@library.test');
  console.log('  Password: Password123!');
  console.log('  Org:      Apex Central University');
  console.log('  Library:  Main Campus Library\n');
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});

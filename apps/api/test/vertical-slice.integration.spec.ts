import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { UserEntity } from '../src/database/control-plane/entities/user.entity';
import { OrganizationEntity } from '../src/database/control-plane/entities/organization.entity';
import { OrgMembershipEntity } from '../src/database/control-plane/entities/org-membership.entity';
import { OrgInvitationEntity } from '../src/database/control-plane/entities/org-invitation.entity';
import { TenantDatabaseRegistryEntity } from '../src/database/control-plane/entities/tenant-registry.entity';
import { ControlPlaneAuditLogEntity } from '../src/database/control-plane/entities/control-plane-audit.entity';
import { InitialControlPlane1700000000000 } from '../src/database/control-plane/migrations/1700000000000-InitialControlPlane';
import { AddUserDisplayName1700000000002 } from '../src/database/control-plane/migrations/1700000000002-AddUserDisplayName';
import { TenantDatabaseRegistryService } from '../src/modules/control-plane/tenant-database-registry.service';
import { TenantConnectionService } from '../src/modules/tenant-connection/tenant-connection.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { OrganizationsService } from '../src/modules/organizations/organizations.service';
import { OrgRole } from '@library/contracts';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('Vertical Slice End-to-End Integration Tests', () => {
  let controlPlaneDs: DataSource;
  let registryService: TenantDatabaseRegistryService;
  let connectionService: TenantConnectionService;
  let authService: AuthService;
  let orgsService: OrganizationsService;
  let configService: ConfigService;

  let createdOrgId: string;
  let createdOrgSlug: string;
  let provisionedDbName: string;

  beforeAll(async () => {
    configService = new ConfigService({
      CONTROL_PLANE_DB_HOST: process.env.CONTROL_PLANE_DB_HOST || '127.0.0.1',
      CONTROL_PLANE_DB_PORT: Number(process.env.CONTROL_PLANE_DB_PORT || 5432),
      CONTROL_PLANE_DB_USER: process.env.CONTROL_PLANE_DB_USER || 'postgres',
      CONTROL_PLANE_DB_PASSWORD: process.env.CONTROL_PLANE_DB_PASSWORD || 'postgres',
      CONTROL_PLANE_DB_NAME: process.env.CONTROL_PLANE_DB_NAME || 'control_plane_db',
      TENANT_DB_HOST: process.env.TENANT_DB_HOST || '127.0.0.1',
      TENANT_DB_PORT: Number(process.env.TENANT_DB_PORT || 5432),
      TENANT_DB_USER: process.env.TENANT_DB_USER || 'postgres',
      TENANT_DB_PASSWORD: process.env.TENANT_DB_PASSWORD || 'postgres',
      JWT_SECRET: 'test_jwt_secret_key_minimum_32_characters_for_unit_tests',
    });

    controlPlaneDs = new DataSource({
      type: 'postgres',
      host: configService.get<string>('CONTROL_PLANE_DB_HOST'),
      port: configService.get<number>('CONTROL_PLANE_DB_PORT'),
      username: configService.get<string>('CONTROL_PLANE_DB_USER'),
      password: configService.get<string>('CONTROL_PLANE_DB_PASSWORD'),
      database: configService.get<string>('CONTROL_PLANE_DB_NAME'),
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
      logging: false,
    });

    await controlPlaneDs.initialize();

    const userRepo = controlPlaneDs.getRepository(UserEntity);
    const orgRepo = controlPlaneDs.getRepository(OrganizationEntity);
    const membershipRepo = controlPlaneDs.getRepository(OrgMembershipEntity);
    const inviteRepo = controlPlaneDs.getRepository(OrgInvitationEntity);
    const registryRepo = controlPlaneDs.getRepository(TenantDatabaseRegistryEntity);
    const auditRepo = controlPlaneDs.getRepository(ControlPlaneAuditLogEntity);

    registryService = new TenantDatabaseRegistryService(registryRepo, controlPlaneDs, configService);
    connectionService = new TenantConnectionService(configService, registryService);
    authService = new AuthService(userRepo, membershipRepo, configService);
    orgsService = new OrganizationsService(
      orgRepo,
      membershipRepo,
      inviteRepo,
      userRepo,
      auditRepo,
      registryService,
      connectionService,
    );
  });

  afterAll(async () => {
    // Teardown connections and drop test tenant database
    if (connectionService) {
      await connectionService.onApplicationShutdown();
    }

    if (provisionedDbName && controlPlaneDs?.isInitialized) {
      try {
        await controlPlaneDs.query(`
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = '${provisionedDbName}' AND pid <> pg_backend_pid()
        `);
        await controlPlaneDs.query(`DROP DATABASE IF EXISTS "${provisionedDbName}"`);
      } catch (err) {
        console.warn('Could not drop test tenant db:', err);
      }
    }

    if (createdOrgId && controlPlaneDs?.isInitialized) {
      try {
        await controlPlaneDs.query(`DELETE FROM "organizations" WHERE "organization_id" = $1`, [createdOrgId]);
      } catch {}
    }

    if (controlPlaneDs?.isInitialized) {
      await controlPlaneDs.query(`DELETE FROM "users" WHERE email LIKE '%@slice-test.com'`);
      await controlPlaneDs.destroy();
    }
  });

  it('1. should register a new user with secure password hashing', async () => {
    const registerResult = await authService.register({
      email: 'alice@slice-test.com',
      password: 'SecurePassword123!',
      displayName: 'Alice Architect',
    });

    expect(registerResult.user).toBeDefined();
    expect(registerResult.user.email).toBe('alice@slice-test.com');
    expect(registerResult.user.displayName).toBe('Alice Architect');
    expect(registerResult.token).toBeDefined();

    // Verify password is not plaintext in database
    const userInDb = await controlPlaneDs.getRepository(UserEntity).findOne({
      where: { user_id: registerResult.user.userId },
    });
    expect(userInDb).toBeDefined();
    expect(userInDb!.password_hash).not.toBe('SecurePassword123!');
    expect(userInDb!.password_hash).toMatch(/^\$2[aby]\$/);
  });

  it('2. should authenticate user and reject incorrect credentials', async () => {
    await expect(
      authService.login({
        email: 'alice@slice-test.com',
        password: 'WrongPassword!',
      }),
    ).rejects.toThrow();

    const loginResult = await authService.login({
      email: 'alice@slice-test.com',
      password: 'SecurePassword123!',
    });

    expect(loginResult.user.email).toBe('alice@slice-test.com');
    expect(loginResult.token).toBeTruthy();
  });

  it('3. should create organization and auto-provision isolated tenant database with initial library', async () => {
    const user = await controlPlaneDs.getRepository(UserEntity).findOne({
      where: { email: 'alice@slice-test.com' },
    });
    expect(user).toBeDefined();

    createdOrgSlug = `apex-${Date.now().toString().slice(-6)}`;
    const orgResult = await orgsService.createOrganization(user!.user_id, {
      name: 'Apex Academy',
      slug: createdOrgSlug,
      initialLibraryName: 'Apex Central Campus',
      timezone: 'Asia/Kolkata',
    });

    createdOrgId = orgResult.organization.organizationId;
    expect(createdOrgId).toBeDefined();
    expect(orgResult.role).toBe(OrgRole.OWNER);
    expect(orgResult.libraries).toHaveLength(1);
    expect(orgResult.libraries[0].name).toBe('Apex Central Campus');

    // Verify registry in Control Plane
    const registry = await registryService.getRegistryEntry(createdOrgId);
    expect(registry).toBeDefined();
    expect(registry!.status).toBe('HEALTHY');
    provisionedDbName = registry!.database_name;

    // Verify isolated tenant DB contains the initial library and reader profile
    const tenantDs = await connectionService.getTenantConnection(createdOrgId);
    const libs = await tenantDs.query(`SELECT * FROM "libraries"`);
    expect(libs).toHaveLength(1);
    expect(libs[0].name).toBe('Apex Central Campus');

    const profiles = await tenantDs.query(`SELECT * FROM "reader_profiles" WHERE user_id = $1`, [user!.user_id]);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].display_name).toBe('Alice Architect');
  });

  it('4. should enforce the maximum 3-libraries limit', async () => {
    const user = await controlPlaneDs.getRepository(UserEntity).findOne({
      where: { email: 'alice@slice-test.com' },
    });

    // Create 2nd library
    const lib2 = await orgsService.createLibrary(createdOrgId, user!.user_id, {
      name: 'Apex Engineering Branch',
      slug: 'apex-eng',
      timezone: 'Asia/Kolkata',
    });
    expect(lib2.name).toBe('Apex Engineering Branch');

    // Create 3rd library
    const lib3 = await orgsService.createLibrary(createdOrgId, user!.user_id, {
      name: 'Apex Medical Branch',
      slug: 'apex-med',
      timezone: 'Asia/Kolkata',
    });
    expect(lib3.name).toBe('Apex Medical Branch');

    // Verify 3 libraries are registered in tenant database
    const details = await orgsService.getOrganizationDetails(createdOrgId, user!.user_id);
    expect(details.libraries).toHaveLength(3);

    // Attempting to create 4th library must be rejected
    await expect(
      orgsService.createLibrary(createdOrgId, user!.user_id, {
        name: 'Apex Overflow Branch',
        slug: 'apex-overflow',
        timezone: 'Asia/Kolkata',
      }),
    ).rejects.toThrow();

    // Verify total count strictly remains 3
    const finalDetails = await orgsService.getOrganizationDetails(createdOrgId, user!.user_id);
    expect(finalDetails.libraries).toHaveLength(3);
  });

  it('5. should support invitation creation and acceptance by another user', async () => {
    const alice = await controlPlaneDs.getRepository(UserEntity).findOne({
      where: { email: 'alice@slice-test.com' },
    });

    // Alice invites Bob
    const invite = await orgsService.inviteMember(createdOrgId, alice!.user_id, {
      email: 'bob@slice-test.com',
      proposedRole: OrgRole.ADMIN,
    });

    expect(invite.token).toBeDefined();
    expect(invite.proposedRole).toBe(OrgRole.ADMIN);

    // Register Bob
    const bobAuth = await authService.register({
      email: 'bob@slice-test.com',
      password: 'BobSecurePassword123!',
      displayName: 'Bob Librarian',
    });

    // Bob accepts invitation using the token
    const acceptResult = await orgsService.acceptInvitation(bobAuth.user.userId, invite.token);
    expect(acceptResult.success).toBe(true);
    expect(acceptResult.organizationId).toBe(createdOrgId);

    // Bob now belongs to the organization with ADMIN role
    const bobOrgs = await orgsService.getUserOrganizations(bobAuth.user.userId);
    expect(bobOrgs).toHaveLength(1);
    expect(bobOrgs[0].organization.organizationId).toBe(createdOrgId);
    expect(bobOrgs[0].role).toBe(OrgRole.ADMIN);
  });
});

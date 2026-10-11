import { DataSource } from 'typeorm';
import { TenantDatabaseRegistryService } from '../src/modules/control-plane/tenant-database-registry.service';
import { TenantConnectionService } from '../src/modules/tenant-connection/tenant-connection.service';
import { TenantDatabaseRegistryEntity } from '../src/database/control-plane/entities/tenant-registry.entity';
import { OrganizationEntity } from '../src/database/control-plane/entities/organization.entity';
import { UserEntity } from '../src/database/control-plane/entities/user.entity';
import { OrgMembershipEntity } from '../src/database/control-plane/entities/org-membership.entity';
import { OrgInvitationEntity } from '../src/database/control-plane/entities/org-invitation.entity';
import { ControlPlaneAuditLogEntity } from '../src/database/control-plane/entities/control-plane-audit.entity';
import { InitialControlPlane1700000000000 } from '../src/database/control-plane/migrations/1700000000000-InitialControlPlane';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('Multi-Tenant Database Foundation & Isolation Integration Tests', () => {
  let controlPlaneDs: DataSource;
  let registryService: TenantDatabaseRegistryService;
  let connectionService: TenantConnectionService;
  let configService: ConfigService;

  const orgAlphaId = '11111111-1111-1111-1111-111111111111';
  const orgBetaId = '22222222-2222-2222-2222-222222222222';
  let orgAlphaDbName = '';
  let orgBetaDbName = '';

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
      migrations: [InitialControlPlane1700000000000],
      synchronize: false,
      logging: false,
    });

    await controlPlaneDs.initialize();
    await controlPlaneDs.runMigrations();

    const registryRepo = controlPlaneDs.getRepository(TenantDatabaseRegistryEntity);
    registryService = new TenantDatabaseRegistryService(registryRepo, controlPlaneDs, configService);
    connectionService = new TenantConnectionService(configService, registryService);

    // Seed test organizations
    const orgRepo = controlPlaneDs.getRepository(OrganizationEntity);
    await orgRepo.delete([orgAlphaId, orgBetaId]);

    const orgAlpha = orgRepo.create({
      organization_id: orgAlphaId,
      name: 'Alpha Test Organization',
      slug: 'alpha-test-org',
      status: 'ACTIVE',
    });
    const orgBeta = orgRepo.create({
      organization_id: orgBetaId,
      name: 'Beta Test Organization',
      slug: 'beta-test-org',
      status: 'ACTIVE',
    });

    await orgRepo.save([orgAlpha, orgBeta]);
  }, 30000);

  afterAll(async () => {
    // Teardown tenant pools and test databases
    await connectionService.onApplicationShutdown();

    if (orgAlphaDbName) {
      await controlPlaneDs.query(`DROP DATABASE IF EXISTS "${orgAlphaDbName}"`);
    }
    if (orgBetaDbName) {
      await controlPlaneDs.query(`DROP DATABASE IF EXISTS "${orgBetaDbName}"`);
    }

    if (controlPlaneDs.isInitialized) {
      const orgRepo = controlPlaneDs.getRepository(OrganizationEntity);
      await orgRepo.delete([orgAlphaId, orgBetaId]);
      await controlPlaneDs.destroy();
    }
  }, 30000);

  it('1. should provision separate tenant databases and apply initial migrations reproducibly', async () => {
    // Clean up existing databases if present from previous run
    const existingAlpha = await registryService.getRegistryEntry(orgAlphaId);
    if (existingAlpha) {
      await controlPlaneDs.query(`DROP DATABASE IF EXISTS "${existingAlpha.database_name}"`);
      await controlPlaneDs.getRepository(TenantDatabaseRegistryEntity).delete(orgAlphaId);
    }
    const existingBeta = await registryService.getRegistryEntry(orgBetaId);
    if (existingBeta) {
      await controlPlaneDs.query(`DROP DATABASE IF EXISTS "${existingBeta.database_name}"`);
      await controlPlaneDs.getRepository(TenantDatabaseRegistryEntity).delete(orgBetaId);
    }

    // Provision Tenant Alpha
    const regAlpha = await registryService.provisionTenantDatabase(orgAlphaId, 'alpha-test-org');
    expect(regAlpha).toBeDefined();
    expect(regAlpha.database_name).toContain('tenant_alpha_test_org_');
    expect(regAlpha.status).toBe('HEALTHY');
    orgAlphaDbName = regAlpha.database_name;

    // Provision Tenant Beta
    const regBeta = await registryService.provisionTenantDatabase(orgBetaId, 'beta-test-org');
    expect(regBeta).toBeDefined();
    expect(regBeta.database_name).toContain('tenant_beta_test_org_');
    expect(regBeta.database_name).not.toEqual(regAlpha.database_name);
    orgBetaDbName = regBeta.database_name;

    // Verify tenant migrations can be applied reproducibly without errors
    await expect(registryService.runTenantMigrations(orgAlphaId)).resolves.not.toThrow();
  }, 30000);

  it('2. should verify that organization maps strictly to its own tenant database (Tenant Isolation)', async () => {
    // Resolve Tenant Alpha connection
    const dsAlpha = await connectionService.getTenantConnection(orgAlphaId);
    expect(dsAlpha.isInitialized).toBe(true);

    // Insert Library into Tenant Alpha
    await dsAlpha.query(`
      INSERT INTO "libraries" ("name", "slug", "timezone")
      VALUES ('Alpha Central Library', 'alpha-central', 'Asia/Kolkata');
    `);

    // Verify Alpha library exists in Tenant Alpha
    const alphaLibs = await dsAlpha.query(`SELECT * FROM "libraries" WHERE "slug" = 'alpha-central'`);
    expect(alphaLibs.length).toBe(1);
    expect(alphaLibs[0].name).toBe('Alpha Central Library');

    // Resolve Tenant Beta connection
    const dsBeta = await connectionService.getTenantConnection(orgBetaId);
    expect(dsBeta.isInitialized).toBe(true);

    // Verify Tenant Beta cannot see Tenant Alpha's library
    const betaLibs = await dsBeta.query(`SELECT * FROM "libraries" WHERE "slug" = 'alpha-central'`);
    expect(betaLibs.length).toBe(0);

    // Insert Library into Tenant Beta
    await dsBeta.query(`
      INSERT INTO "libraries" ("name", "slug", "timezone")
      VALUES ('Beta Community Library', 'beta-community', 'Asia/Kolkata');
    `);

    // Verify Tenant Alpha cannot see Tenant Beta's library
    const alphaCheckBeta = await dsAlpha.query(`SELECT * FROM "libraries" WHERE "slug" = 'beta-community'`);
    expect(alphaCheckBeta.length).toBe(0);
  }, 30000);

  it('3. should reject connection requests for non-existent organizations', async () => {
    const fakeOrgId = '99999999-9999-9999-9999-999999999999';
    await expect(connectionService.getTenantConnection(fakeOrgId)).rejects.toThrow();
  });

  it('4. should enforce the maximum of three libraries per organization race-safely', async () => {
    const dsAlpha = await connectionService.getTenantConnection(orgAlphaId);

    // Library 1 already exists ('Alpha Central Library')
    // Insert Library 2
    await dsAlpha.query(`
      INSERT INTO "libraries" ("name", "slug", "timezone")
      VALUES ('Alpha Branch 2', 'alpha-branch-2', 'Asia/Kolkata');
    `);

    // Insert Library 3
    await dsAlpha.query(`
      INSERT INTO "libraries" ("name", "slug", "timezone")
      VALUES ('Alpha Branch 3', 'alpha-branch-3', 'Asia/Kolkata');
    `);

    const currentCount = await dsAlpha.query(`SELECT COUNT(*) as count FROM "libraries"`);
    expect(Number(currentCount[0].count)).toBe(3);

    // Attempting to insert Library 4 MUST throw the database trigger exception
    let fourthInsertFailed = false;
    try {
      await dsAlpha.query(`
        INSERT INTO "libraries" ("name", "slug", "timezone")
        VALUES ('Alpha Branch 4', 'alpha-branch-4', 'Asia/Kolkata');
      `);
    } catch (err: any) {
      fourthInsertFailed = true;
      expect(err.message).toContain('An organization cannot exceed the maximum limit of three libraries.');
    }
    expect(fourthInsertFailed).toBe(true);

    // Concurrency test: execute multiple simultaneous inserts for the 4th slot
    const concurrentAttempts = await Promise.allSettled([
      dsAlpha.query(`INSERT INTO "libraries" ("name", "slug") VALUES ('Alpha Race A', 'alpha-race-a')`),
      dsAlpha.query(`INSERT INTO "libraries" ("name", "slug") VALUES ('Alpha Race B', 'alpha-race-b')`),
      dsAlpha.query(`INSERT INTO "libraries" ("name", "slug") VALUES ('Alpha Race C', 'alpha-race-c')`),
    ]);

    // All concurrent attempts MUST be rejected
    for (const attempt of concurrentAttempts) {
      expect(attempt.status).toBe('rejected');
      if (attempt.status === 'rejected') {
        expect(attempt.reason.message).toContain('An organization cannot exceed the maximum limit of three libraries.');
      }
    }

    // Verify count remains strictly 3
    const finalCount = await dsAlpha.query(`SELECT COUNT(*) as count FROM "libraries"`);
    expect(Number(finalCount[0].count)).toBe(3);
  }, 30000);
});

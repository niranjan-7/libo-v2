import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
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
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { FloorPlanService } from '../src/modules/floor-plan/floor-plan.service';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('Floor Management, Spatial Layouts, Versions & Publishing Integration Tests', () => {
  let controlPlaneDs: DataSource;
  let registryService: TenantDatabaseRegistryService;
  let connectionService: TenantConnectionService;
  let authService: AuthService;
  let orgsService: OrganizationsService;
  let catalogService: CatalogService;
  let auditService: AuditService;
  let floorPlanService: FloorPlanService;
  let configService: ConfigService;

  let staffUserId: string;
  let readerUserId: string;
  let testOrgId: string;
  let libraryAId: string;
  let libraryBId: string;
  let provisionedDbName: string;

  let floorAId: string;
  let rackLocationA1Id: string;
  let rackLocationA2Id: string;
  let rackLocationB1Id: string;

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
    catalogService = new CatalogService(connectionService);
    auditService = new AuditService(connectionService);
    floorPlanService = new FloorPlanService(connectionService, auditService);

    // Setup Users
    const staffReg = await authService.register({
      email: `floor-staff-${Date.now()}@library.test`,
      password: 'SecurePassword123!',
      displayName: 'Spatial Map Librarian',
    });
    staffUserId = staffReg.user.userId;

    const readerReg = await authService.register({
      email: `floor-reader-${Date.now()}@library.test`,
      password: 'SecurePassword123!',
      displayName: 'Reader Map Viewer',
    });
    readerUserId = readerReg.user.userId;

    // Create Organization & Provision Dedicated Tenant Database
    const orgSlug = `floor-test-${Date.now()}`;
    const orgResult = await orgsService.createOrganization(staffUserId, {
      name: 'Spatial Floor Plan Testing Org',
      slug: orgSlug,
    });
    testOrgId = orgResult.organization.organizationId;

    const reg = await registryRepo.findOneBy({ organization_id: testOrgId });
    provisionedDbName = reg?.database_name || '';

    // Create Library A and Library B to prove isolation
    const libA = await orgsService.createLibrary(testOrgId, staffUserId, {
      name: 'North Campus Library',
      slug: 'north-lib',
    });
    libraryAId = libA.libraryId;

    const libB = await orgsService.createLibrary(testOrgId, staffUserId, {
      name: 'South Branch Library',
      slug: 'south-lib',
    });
    libraryBId = libB.libraryId;

    // Seed Library A catalog inventory to have logical racks and physical copies
    await catalogService.seedLibrary(testOrgId, libraryAId);
    await catalogService.seedLibrary(testOrgId, libraryBId);

    // Get logical racks from Library A
    const tenantDs = await connectionService.getTenantConnection(testOrgId);
    const racksA = await tenantDs.query(
      `SELECT * FROM "locations" WHERE library_id = $1 AND location_type = 'RACK' ORDER BY code ASC`,
      [libraryAId],
    );
    expect(racksA.length).toBeGreaterThanOrEqual(2);
    rackLocationA1Id = racksA[0].location_id;
    rackLocationA2Id = racksA[1].location_id;

    // Get logical rack from Library B for cross-library testing
    const racksB = await tenantDs.query(
      `SELECT * FROM "locations" WHERE library_id = $1 AND location_type = 'RACK' ORDER BY code ASC`,
      [libraryBId],
    );
    rackLocationB1Id = racksB[0].location_id;
  }, 45000);

  afterAll(async () => {
    try {
      if (connectionService) {
        await connectionService.onApplicationShutdown();
      }
      if (provisionedDbName) {
        await controlPlaneDs.query(`
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = '${provisionedDbName}' AND pid <> pg_backend_pid()
        `);
        await controlPlaneDs.query(`DROP DATABASE IF EXISTS "${provisionedDbName}"`);
      }
      if (testOrgId) {
        await controlPlaneDs.query(`DELETE FROM "tenant_database_registry" WHERE organization_id = $1`, [testOrgId]);
        await controlPlaneDs.query(`DELETE FROM "org_memberships" WHERE organization_id = $1`, [testOrgId]);
        await controlPlaneDs.query(`DELETE FROM "organizations" WHERE organization_id = $1`, [testOrgId]);
      }
    } finally {
      if (controlPlaneDs.isInitialized) {
        await controlPlaneDs.destroy();
      }
    }
  });

  // ==========================================
  // 1. FLOOR MANAGEMENT
  // ==========================================

  describe('Floor Management CRUD', () => {
    it('creates a new library floor and prevents duplicate floor numbers in the same library', async () => {
      const floor = await floorPlanService.createFloor(testOrgId, libraryAId, staffUserId, {
        name: 'Second Floor Science Annex',
        floorNumber: 2,
        canvasWidth: 1400,
        canvasHeight: 900,
      });

      expect(floor.floorId).toBeDefined();
      expect(floor.name).toBe('Second Floor Science Annex');
      expect(floor.floorNumber).toBe(2);
      expect(floor.canvasWidth).toBe(1400);
      expect(floor.canvasHeight).toBe(900);
      floorAId = floor.floorId;

      // Duplicate floorNumber in same library must throw ConflictException
      await expect(
        floorPlanService.createFloor(testOrgId, libraryAId, staffUserId, {
          name: 'Duplicate Floor 2',
          floorNumber: 2,
        }),
      ).rejects.toThrow(ConflictException);

      // Same floorNumber in different library (Library B) is completely allowed!
      const floorB = await floorPlanService.createFloor(testOrgId, libraryBId, staffUserId, {
        name: 'South Branch Level 2',
        floorNumber: 2,
      });
      expect(floorB.floorId).toBeDefined();
    });

    it('updates floor dimensions and details', async () => {
      const updated = await floorPlanService.updateFloor(
        testOrgId,
        libraryAId,
        floorAId,
        staffUserId,
        {
          name: 'Level 2 - Applied Sciences',
          canvasWidth: 1600,
          canvasHeight: 1000,
        },
      );

      expect(updated.name).toBe('Level 2 - Applied Sciences');
      expect(updated.canvasWidth).toBe(1600);
      expect(updated.canvasHeight).toBe(1000);
    });
  });

  // ==========================================
  // 2. UNPUBLISHED DRAFTS & ACCESS BOUNDARIES
  // ==========================================

  describe('Unpublished Drafts & Reader Visibility Boundary', () => {
    it('prevents readers from seeing unpublished drafts', async () => {
      // Newly created Floor 2 only has an initial draft version, no published version
      // Attempting to query published floor plan must throw NotFoundException
      await expect(
        floorPlanService.getPublishedFloorPlan(testOrgId, libraryAId, floorAId),
      ).rejects.toThrow(NotFoundException);

      // Readers querying versions only see published versions (0 items)
      const readerVersions = await floorPlanService.getVersions(
        testOrgId,
        libraryAId,
        floorAId,
        false, // not staff
      );
      expect(readerVersions.length).toBe(0);

      // Staff querying versions can see the draft version
      const staffVersions = await floorPlanService.getVersions(
        testOrgId,
        libraryAId,
        floorAId,
        true, // staff
      );
      expect(staffVersions.length).toBe(1);
      expect(staffVersions[0].status).toBe('DRAFT');
    });
  });

  // ==========================================
  // 3. DRAFT EDITING & VALIDATION
  // ==========================================

  describe('Draft Editing & Validation Rules', () => {
    let draftVersionId: string;

    beforeAll(async () => {
      const draft = await floorPlanService.getOrCreateDraft(
        testOrgId,
        libraryAId,
        floorAId,
        staffUserId,
      );
      draftVersionId = draft.versionId;
    });

    it('saves draft with heterogeneous spatial layout elements (RACK, WALL, DOOR, DESK)', async () => {
      const saved = await floorPlanService.saveDraft(
        testOrgId,
        libraryAId,
        floorAId,
        draftVersionId,
        staffUserId,
        {
          elements: [
            {
              elementType: 'WALL',
              x: 50,
              y: 50,
              width: 500,
              height: 20,
              rotation: 0,
              zIndex: 1,
              properties: { color: '#334155' },
            },
            {
              elementType: 'DOOR',
              x: 250,
              y: 50,
              width: 80,
              height: 20,
              rotation: 0,
              zIndex: 2,
              properties: { swing: 'left' },
            },
            {
              elementType: 'DESK',
              x: 100,
              y: 200,
              width: 140,
              height: 80,
              rotation: 0,
              zIndex: 3,
              properties: { label: 'Information Desk' },
            },
            {
              elementType: 'RACK',
              x: 400,
              y: 300,
              width: 120,
              height: 60,
              rotation: 90,
              zIndex: 4,
              linkedLocationId: rackLocationA1Id,
              properties: { shelfCount: 6 },
            },
          ],
        },
      );

      expect(saved.elementCount).toBe(4);
      expect(saved.elements?.some((e) => e.elementType === 'WALL')).toBe(true);
      expect(saved.elements?.some((e) => e.elementType === 'DOOR')).toBe(true);
      expect(saved.elements?.some((e) => e.elementType === 'DESK')).toBe(true);
      expect(saved.elements?.some((e) => e.elementType === 'RACK')).toBe(true);
    });

    it('fails validation when an element has invalid dimensions (width or height <= 0)', async () => {
      await floorPlanService.saveDraft(
        testOrgId,
        libraryAId,
        floorAId,
        draftVersionId,
        staffUserId,
        {
          elements: [
            {
              elementType: 'WALL',
              x: 50,
              y: 50,
              width: -10, // Invalid width
              height: 40,
            },
            {
              elementType: 'RACK',
              x: 100,
              y: 100,
              width: 80,
              height: 0, // Invalid height
              linkedLocationId: rackLocationA1Id,
            },
          ],
        },
      );

      const validation = await floorPlanService.validateDraft(
        testOrgId,
        libraryAId,
        floorAId,
        draftVersionId,
      );
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((err) => err.includes('invalid dimensions'))).toBe(true);

      // Attempting to publish an invalid draft throws BadRequestException
      await expect(
        floorPlanService.publishDraft(testOrgId, libraryAId, floorAId, draftVersionId, staffUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('fails validation when a spatial RACK element has a missing logical rack link', async () => {
      await floorPlanService.saveDraft(
        testOrgId,
        libraryAId,
        floorAId,
        draftVersionId,
        staffUserId,
        {
          elements: [
            {
              elementType: 'RACK',
              x: 100,
              y: 100,
              width: 100,
              height: 50,
              linkedLocationId: null, // Missing rack link
            },
          ],
        },
      );

      const validation = await floorPlanService.validateDraft(
        testOrgId,
        libraryAId,
        floorAId,
        draftVersionId,
      );
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((err) => err.includes('not linked to any logical rack location'))).toBe(true);
    });

    it('fails validation when multiple spatial elements link to the same logical rack (duplicate link)', async () => {
      await floorPlanService.saveDraft(
        testOrgId,
        libraryAId,
        floorAId,
        draftVersionId,
        staffUserId,
        {
          elements: [
            {
              elementType: 'RACK',
              x: 100,
              y: 100,
              width: 100,
              height: 50,
              linkedLocationId: rackLocationA1Id,
            },
            {
              elementType: 'RACK',
              x: 250,
              y: 100,
              width: 100,
              height: 50,
              linkedLocationId: rackLocationA1Id, // Duplicate link!
            },
          ],
        },
      );

      const validation = await floorPlanService.validateDraft(
        testOrgId,
        libraryAId,
        floorAId,
        draftVersionId,
      );
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((err) => err.includes('Duplicate rack link'))).toBe(true);
    });

    it('fails validation on cross-library location linking (linking Library B rack in Library A)', async () => {
      await floorPlanService.saveDraft(
        testOrgId,
        libraryAId,
        floorAId,
        draftVersionId,
        staffUserId,
        {
          elements: [
            {
              elementType: 'RACK',
              x: 100,
              y: 100,
              width: 100,
              height: 50,
              linkedLocationId: rackLocationB1Id, // From Library B!
            },
          ],
        },
      );

      const validation = await floorPlanService.validateDraft(
        testOrgId,
        libraryAId,
        floorAId,
        draftVersionId,
      );
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((err) => err.includes('Cross-library violation'))).toBe(true);
    });
  });

  // ==========================================
  // 4. PUBLISHING & VERSION LIFECYCLE
  // ==========================================

  describe('Publishing, Archiving & Version Lifecycle', () => {
    let version1Id: string;
    let version2Id: string;

    it('validates and publishes a valid draft floor plan', async () => {
      const draft = await floorPlanService.getOrCreateDraft(
        testOrgId,
        libraryAId,
        floorAId,
        staffUserId,
      );
      version1Id = draft.versionId;

      // Save valid layout with distinct rack locations
      await floorPlanService.saveDraft(
        testOrgId,
        libraryAId,
        floorAId,
        version1Id,
        staffUserId,
        {
          elements: [
            {
              elementType: 'WALL',
              x: 10,
              y: 10,
              width: 800,
              height: 15,
            },
            {
              elementType: 'DESK',
              x: 50,
              y: 50,
              width: 120,
              height: 60,
            },
            {
              elementType: 'RACK',
              x: 200,
              y: 100,
              width: 120,
              height: 50,
              linkedLocationId: rackLocationA1Id,
            },
            {
              elementType: 'RACK',
              x: 350,
              y: 100,
              width: 120,
              height: 50,
              linkedLocationId: rackLocationA2Id,
            },
          ],
        },
      );

      const pubRes = await floorPlanService.publishDraft(
        testOrgId,
        libraryAId,
        floorAId,
        version1Id,
        staffUserId,
      );
      expect(pubRes.status).toBe('PUBLISHED');
      expect(pubRes.publishedAt).toBeDefined();

      // Now readers querying published floor plan can view the map!
      const readerView = await floorPlanService.getPublishedFloorPlan(
        testOrgId,
        libraryAId,
        floorAId,
      );
      expect(readerView.status).toBe('PUBLISHED');
      expect(readerView.versionNumber).toBe(pubRes.versionNumber);
      expect(readerView.fixtures.length).toBe(4);
    });

    it('archives prior published version when a new draft version is published', async () => {
      // Create new draft (clones version 1 layout automatically)
      const draft2 = await floorPlanService.getOrCreateDraft(
        testOrgId,
        libraryAId,
        floorAId,
        staffUserId,
      );
      expect(draft2.versionNumber).toBeGreaterThan(1);
      expect(draft2.status).toBe('DRAFT');
      version2Id = draft2.versionId;

      // Add another element to draft 2
      await floorPlanService.saveDraft(
        testOrgId,
        libraryAId,
        floorAId,
        version2Id,
        staffUserId,
        {
          elements: [
            ...(draft2.elements || []),
            {
              elementType: 'DOOR',
              x: 400,
              y: 10,
              width: 60,
              height: 15,
            },
          ],
        },
      );

      // Publish version 2
      await floorPlanService.publishDraft(
        testOrgId,
        libraryAId,
        floorAId,
        version2Id,
        staffUserId,
      );

      // Check version 1 status is now ARCHIVED
      const versions = await floorPlanService.getVersions(
        testOrgId,
        libraryAId,
        floorAId,
        true,
      );
      const v1 = versions.find((v) => v.versionId === version1Id);
      const v2 = versions.find((v) => v.versionId === version2Id);

      expect(v1?.status).toBe('ARCHIVED');
      expect(v2?.status).toBe('PUBLISHED');
    });

    it('restores a prior version into an active draft', async () => {
      // Restore Version 1 into draft
      const restoredDraft = await floorPlanService.restoreVersion(
        testOrgId,
        libraryAId,
        floorAId,
        version1Id,
        staffUserId,
      );

      expect(restoredDraft.status).toBe('DRAFT');
      expect(restoredDraft.elementCount).toBe(4); // Version 1 had 4 elements
      expect(restoredDraft.elements?.some((e) => e.elementType === 'DOOR')).toBe(false);
    });
  });

  // ==========================================
  // 5. CROSS-LIBRARY ISOLATION
  // ==========================================

  describe('Cross-Library Map Isolation', () => {
    it('proves publishing Library A map has zero effect on Library B map', async () => {
      // Create a floor in Library B
      const floorB = await floorPlanService.createFloor(
        testOrgId,
        libraryBId,
        staffUserId,
        {
          name: 'South Floor 3',
          floorNumber: 3,
        },
      );

      // Verify Library B floor has no published versions
      await expect(
        floorPlanService.getPublishedFloorPlan(testOrgId, libraryBId, floorB.floorId),
      ).rejects.toThrow(NotFoundException);

      // Library A floor is still published and completely unaffected
      const mapA = await floorPlanService.getPublishedFloorPlan(
        testOrgId,
        libraryAId,
        floorAId,
      );
      expect(mapA.status).toBe('PUBLISHED');
      expect(mapA.floorId).toBe(floorAId);
    });
  });

  // ==========================================
  // 6. REAL RACK SHELF COPIES INTEGRATION
  // ==========================================

  describe('Real Rack Shelf Copies from Database', () => {
    it('returns real physical BookCopies and logical shelf locations when inspecting a rack', async () => {
      const rackDetail = await catalogService.getRackShelves(
        testOrgId,
        libraryAId,
        'A', // Rack A
      );

      expect(rackDetail.rackCode).toBeDefined();
      expect(rackDetail.shelves.length).toBeGreaterThan(0);

      // Shelves must contain real physical copies with barcodes and statuses
      const totalCopiesFound = rackDetail.shelves.reduce((acc, s) => acc + s.totalCopies, 0);
      expect(totalCopiesFound).toBeGreaterThanOrEqual(1);

      const shelfWithCopies = rackDetail.shelves.find((s) => s.copies.length > 0)!;
      const copy = shelfWithCopies.copies[0];
      expect(copy.barcode).toMatch(/^CP-/);
      expect(copy.bookTitle).toBeDefined();
      expect(copy.homeLocation.code).toBeDefined();
    });
  });
});

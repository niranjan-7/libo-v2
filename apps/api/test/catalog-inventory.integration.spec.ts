import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ConflictException, NotFoundException } from '@nestjs/common';
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
import { CopyCondition, CopyStatus } from '@library/contracts';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('Catalog & Physical Location Integration Tests', () => {
  let controlPlaneDs: DataSource;
  let registryService: TenantDatabaseRegistryService;
  let connectionService: TenantConnectionService;
  let authService: AuthService;
  let orgsService: OrganizationsService;
  let catalogService: CatalogService;
  let configService: ConfigService;

  let testUserId: string;
  let testOrgId: string;
  let library1Id: string;
  let library2Id: string;
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
    catalogService = new CatalogService(connectionService);

    // Setup Test User and Organization
    const regResult = await authService.register({
      email: `catalog-tester-${Date.now()}@library.test`,
      password: 'SecurePassword123!',
      displayName: 'Catalog Lead',
    });
    testUserId = regResult.user.userId;

    const orgSlug = `catalog-test-${Date.now()}`;
    const orgResult = await orgsService.createOrganization(testUserId, {
      name: 'Metropolitan Library Network',
      slug: orgSlug,
    });
    testOrgId = orgResult.organization.organizationId;

    const regEntry = await registryRepo.findOne({ where: { organization_id: testOrgId } });
    provisionedDbName = regEntry?.database_name || '';

    // Create 2 libraries in this organization
    const lib1 = await orgsService.createLibrary(testOrgId, testUserId, {
      name: 'Downtown Central Library',
      slug: 'central-lib',
    });
    library1Id = lib1.libraryId;

    const lib2 = await orgsService.createLibrary(testOrgId, testUserId, {
      name: 'Westside Branch Library',
      slug: 'westside-branch',
    });
    library2Id = lib2.libraryId;
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
      if (testUserId) {
        await controlPlaneDs.query(`DELETE FROM "users" WHERE user_id = $1`, [testUserId]);
      }
      await controlPlaneDs.destroy();
    } catch (e) {
      // Ignore teardown errors
    }
  });

  describe('1. Auto-seeding and Catalog Search', () => {
    it('should auto-seed demo works and copies on first catalog search for Library 1', async () => {
      const result = await catalogService.searchCatalog(testOrgId, library1Id, {});
      expect(result.items.length).toBeGreaterThanOrEqual(8);
      expect(result.total).toBeGreaterThanOrEqual(8);

      const titles = result.items.map((b) => b.title);
      expect(titles).toContain('The Midnight Library');
      expect(titles).toContain('Project Hail Mary');
      expect(titles).toContain('Dune');
      expect(titles).toContain('Educated');
    });

    it('should filter catalog by text search across title and author', async () => {
      const searchTitle = await catalogService.searchCatalog(testOrgId, library1Id, { search: 'midnight' });
      expect(searchTitle.items.length).toBe(1);
      expect(searchTitle.items[0].title).toBe('The Midnight Library');

      const searchAuthor = await catalogService.searchCatalog(testOrgId, library1Id, { search: 'Andy Weir' });
      expect(searchAuthor.items.length).toBe(1);
      expect(searchAuthor.items[0].title).toBe('Project Hail Mary');
      expect(searchAuthor.items[0].authors.map((a) => a.name)).toContain('Andy Weir');
    });

    it('should filter catalog by category', async () => {
      const sciFi = await catalogService.searchCatalog(testOrgId, library1Id, { category: 'Science Fiction' });
      expect(sciFi.items.length).toBe(2);
      const titles = sciFi.items.map((b) => b.title);
      expect(titles).toContain('Project Hail Mary');
      expect(titles).toContain('Dune');
    });

    it('should return empty list when no titles match query', async () => {
      const noMatch = await catalogService.searchCatalog(testOrgId, library1Id, { search: 'NonExistentTitle12345' });
      expect(noMatch.items.length).toBe(0);
      expect(noMatch.total).toBe(0);
    });
  });

  describe('2. Multi-copy Distribution & Logical Locations', () => {
    it('should support multiple physical copies of the same edition placed across different shelves and racks', async () => {
      const search = await catalogService.searchCatalog(testOrgId, library1Id, { search: 'Midnight' });
      const midnightBookId = search.items[0].bookId;

      const details = await catalogService.getBookDetails(testOrgId, library1Id, midnightBookId);
      expect(details.title).toBe('The Midnight Library');
      expect(details.editions?.length).toBeGreaterThanOrEqual(1);

      const edition = details.editions![0];
      expect(edition.copies?.length).toBe(3);

      const barcodes = edition.copies!.map((c) => c.barcode);
      expect(barcodes).toContain('CP-00142');
      expect(barcodes).toContain('CP-00143');
      expect(barcodes).toContain('CP-00310');

      // Check rack and shelf locations
      const copy142 = edition.copies!.find((c) => c.barcode === 'CP-00142');
      const copy310 = edition.copies!.find((c) => c.barcode === 'CP-00310');

      expect(copy142?.homeLocation.code).toBe('F1-RA-S2'); // Rack A Shelf 2
      expect(copy310?.homeLocation.code).toBe('F1-RC-S3'); // Rack C Shelf 3
    });

    it('should throw NotFoundException for non-existent book ID', async () => {
      await expect(
        catalogService.getBookDetails(testOrgId, library1Id, '00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('3. Floor-Plan Reader Flow & Decoupled Spatial Layouts', () => {
    it('should return published floor plan with canvas metadata and spatial fixtures', async () => {
      const floorPlan = await catalogService.getFloorPlan(testOrgId, library1Id, 1);
      expect(floorPlan.floorNumber).toBe(1);
      expect(floorPlan.canvasWidth).toBe(1200);
      expect(floorPlan.canvasHeight).toBe(800);
      expect(floorPlan.fixtures.length).toBe(6); // Racks A through F

      const rackAFixture = floorPlan.fixtures.find((f) => f.linkedRackCode === 'A');
      expect(rackAFixture).toBeDefined();
      expect(rackAFixture?.elementType).toBe('RACK');
      expect(rackAFixture?.x).toBe(150);
      expect(rackAFixture?.y).toBe(150);
      expect(rackAFixture?.hasBooks).toBe(true);
      expect(rackAFixture?.availableCopiesCount).toBeGreaterThan(0);
    });

    it('should inspect Rack A shelves and return real titles and physical copies on each shelf', async () => {
      const rackDetails = await catalogService.getRackShelves(testOrgId, library1Id, 'A');
      expect(rackDetails.rackCode).toBe('A');
      expect(rackDetails.shelves.length).toBe(6); // Shelves 1 to 6

      // Shelf 2 has The Midnight Library (CP-00142, CP-00143)
      const shelf2 = rackDetails.shelves.find((s) => s.shelfNumber === 2);
      expect(shelf2).toBeDefined();
      expect(shelf2?.copies.length).toBe(3); // 2 copies of Midnight Library + 1 Library Book
      const shelf2Barcodes = shelf2?.copies.map((c) => c.barcode);
      expect(shelf2Barcodes).toContain('CP-00142');
      expect(shelf2Barcodes).toContain('CP-00143');
      expect(shelf2Barcodes).toContain('CP-00088');

      // Shelf 3 has Educated (CP-00121)
      const shelf3 = rackDetails.shelves.find((s) => s.shelfNumber === 3);
      expect(shelf3?.copies.length).toBe(1);
      expect(shelf3?.copies[0].barcode).toBe('CP-00121');

      // Shelf 5 has The Book Thief (CP-00031)
      const shelf5 = rackDetails.shelves.find((s) => s.shelfNumber === 5);
      expect(shelf5?.copies.length).toBe(1);
      expect(shelf5?.copies[0].barcode).toBe('CP-00031');
    });

    it('should throw NotFoundException when inspecting a non-existent rack', async () => {
      await expect(
        catalogService.getRackShelves(testOrgId, library1Id, 'Z'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('4. Physical Copy Inventory & Management', () => {
    it('should return physical copy inventory with accurate KPI statistics', async () => {
      const inventory = await catalogService.getInventory(testOrgId, library1Id, {});
      expect(inventory.total).toBe(8);
      expect(inventory.stats.totalCopies).toBe(8);
      expect(inventory.stats.availableCopies).toBe(6);
      expect(inventory.stats.loanedCopies).toBe(2); // The Library Book & Dune
      expect(inventory.stats.exceptionsCount).toBe(1); // Dune is DAMAGED
    });

    it('should filter inventory by copy status and condition', async () => {
      const loaned = await catalogService.getInventory(testOrgId, library1Id, { status: CopyStatus.LOANED });
      expect(loaned.items.length).toBe(2);
      loaned.items.forEach((c) => expect(c.status).toBe(CopyStatus.LOANED));

      const damaged = await catalogService.getInventory(testOrgId, library1Id, { condition: CopyCondition.DAMAGED });
      expect(damaged.items.length).toBe(1);
      expect(damaged.items[0].barcode).toBe('CP-00234');
    });

    it('should create a new copy and enforce library-level barcode uniqueness', async () => {
      const search = await catalogService.searchCatalog(testOrgId, library1Id, { search: 'Dune' });
      const duneDetails = await catalogService.getBookDetails(testOrgId, library1Id, search.items[0].bookId);
      const duneEditionId = duneDetails.editions![0].editionId;

      // Get shelf location id for Rack B Shelf 1
      const rackB = await catalogService.getRackShelves(testOrgId, library1Id, 'B');
      const shelf1Id = rackB.shelves[0].shelfLocationId;

      const newCopy = await catalogService.createCopy(testOrgId, library1Id, {
        editionId: duneEditionId,
        barcode: 'CP-NEW-999',
        condition: CopyCondition.NEW,
        status: CopyStatus.AVAILABLE,
        homeLocationId: shelf1Id,
      });

      expect(newCopy.barcode).toBe('CP-NEW-999');
      expect(newCopy.condition).toBe(CopyCondition.NEW);
      expect(newCopy.status).toBe(CopyStatus.AVAILABLE);

      // Attempting to register the same barcode in the same library must throw ConflictException
      await expect(
        catalogService.createCopy(testOrgId, library1Id, {
          editionId: duneEditionId,
          barcode: 'CP-NEW-999',
          condition: CopyCondition.NEW,
          status: CopyStatus.AVAILABLE,
          homeLocationId: shelf1Id,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('5. Library-Level Isolation', () => {
    it('should isolate physical copies between libraries in the same tenant organization', async () => {
      // Library 2 initially has 0 copies
      const tenantDs = await connectionService.getTenantConnection(testOrgId);
      const lib2CopyCount = await tenantDs.query(
        `SELECT COUNT(*) as count FROM "book_copies" WHERE library_id = $1`,
        [library2Id],
      );
      expect(parseInt(lib2CopyCount[0].count, 10)).toBe(0);

      // Books (conceptual works) are visible across libraries
      const lib2Catalog = await catalogService.searchCatalog(testOrgId, library2Id, {});
      expect(lib2Catalog.total).toBeGreaterThanOrEqual(8);

      // But all availableCopies in Library 2 must be 0 because physical copies belong to Library 1
      for (const item of lib2Catalog.items) {
        expect(item.availableCopies).toBe(0);
        expect(item.totalCopies).toBe(0);
      }

      // Barcode 'CP-00142' can be safely used in Library 2 without collision with Library 1
      // (barcodes are unique per library)
      const bookDetails = await catalogService.getBookDetails(testOrgId, library1Id, lib2Catalog.items[0].bookId);
      const editionId = bookDetails.editions![0].editionId;

      // Create a dummy shelf in Library 2
      const [floorRes] = await tenantDs.query(
        `INSERT INTO "library_floors" ("library_id", "name", "floor_number", "canvas_width", "canvas_height")
         VALUES ($1, 'Main Floor', 1, 1000, 1000) RETURNING floor_id`,
        [library2Id],
      );
      const [shelfRes] = await tenantDs.query(
        `INSERT INTO "locations" ("library_id", "floor_id", "location_type", "code", "name")
         VALUES ($1, $2, 'SHELF', 'L2-S1', 'Main Shelf') RETURNING location_id`,
        [library2Id, floorRes.floor_id],
      );

      const lib2Copy = await catalogService.createCopy(testOrgId, library2Id, {
        editionId,
        barcode: 'CP-00142', // Same barcode as Library 1's copy!
        condition: CopyCondition.GOOD,
        status: CopyStatus.AVAILABLE,
        homeLocationId: shelfRes.location_id,
      });

      expect(lib2Copy.barcode).toBe('CP-00142');
      expect(lib2Copy.libraryId).toBe(library2Id);

      // Verify Library 1's copy CP-00142 is intact and separate
      const lib1Inventory = await catalogService.getInventory(testOrgId, library1Id, { search: 'CP-00142' });
      expect(lib1Inventory.items.length).toBe(1);
      expect(lib1Inventory.items[0].libraryId).toBe(library1Id);

      // Verify Library 2's inventory has only Library 2's copy
      const lib2Inventory = await catalogService.getInventory(testOrgId, library2Id, { search: 'CP-00142' });
      expect(lib2Inventory.items.length).toBe(1);
      expect(lib2Inventory.items[0].libraryId).toBe(library2Id);
    });
  });
});

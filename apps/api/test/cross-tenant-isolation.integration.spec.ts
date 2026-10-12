import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
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
import { CirculationService } from '../src/modules/circulation/circulation.service';
import { WalletService } from '../src/modules/wallet/wallet.service';
import { FinesService } from '../src/modules/fines/fines.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { CommunityService } from '../src/modules/community/community.service';
import { FloorPlanService } from '../src/modules/floor-plan/floor-plan.service';
import { OrgRole, FineType, CopyStatus, CopyCondition } from '@library/contracts';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('Cross-Tenant Isolation, Concurrent Limits & Resource Boundary Integration Tests', () => {
  let controlPlaneDs: DataSource;
  let registryService: TenantDatabaseRegistryService;
  let connectionService: TenantConnectionService;
  let authService: AuthService;
  let orgsService: OrganizationsService;
  let catalogService: CatalogService;
  let auditService: AuditService;
  let circulationService: CirculationService;
  let walletService: WalletService;
  let finesService: FinesService;
  let notificationsService: NotificationsService;
  let communityService: CommunityService;
  let floorPlanService: FloorPlanService;
  let configService: ConfigService;

  // Test Entities
  let userAlphaId: string;
  let userBetaId: string;
  let orgAlphaId: string;
  let orgBetaId: string;
  let libAlphaId: string;
  let libBetaId: string;
  let dbAlphaName: string;
  let dbBetaName: string;

  // Seeded Resources in Alpha
  let alphaBookId: string;
  let alphaEditionId: string;
  let alphaCopyBarcode: string;
  let alphaFloorId: string;

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
    notificationsService = new NotificationsService(connectionService);
    walletService = new WalletService(connectionService, notificationsService, auditService);
    finesService = new FinesService(connectionService, notificationsService, auditService, walletService);
    circulationService = new CirculationService(connectionService, notificationsService, auditService);
    communityService = new CommunityService(connectionService, auditService);
    floorPlanService = new FloorPlanService(connectionService, auditService);

    // 1. Create Users
    const uAlpha = await authService.register({
      email: `alpha_${Date.now()}@isolation-test.com`,
      password: 'AlphaPassword123!',
      displayName: 'Alpha Lead Librarian',
    });
    userAlphaId = uAlpha.user.userId;

    const uBeta = await authService.register({
      email: `beta_${Date.now()}@isolation-test.com`,
      password: 'BetaPassword123!',
      displayName: 'Beta Lead Librarian',
    });
    userBetaId = uBeta.user.userId;
  }, 45000);

  afterAll(async () => {
    try {
      if (connectionService) {
        await connectionService.onApplicationShutdown();
      }
      if (dbAlphaName) {
        await controlPlaneDs.query(`
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = '${dbAlphaName}' AND pid <> pg_backend_pid()
        `);
        await controlPlaneDs.query(`DROP DATABASE IF EXISTS "${dbAlphaName}"`);
      }
      if (dbBetaName) {
        await controlPlaneDs.query(`
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = '${dbBetaName}' AND pid <> pg_backend_pid()
        `);
        await controlPlaneDs.query(`DROP DATABASE IF EXISTS "${dbBetaName}"`);
      }
      if (orgAlphaId) {
        await controlPlaneDs.query(`DELETE FROM "tenant_database_registry" WHERE organization_id = $1`, [orgAlphaId]);
        await controlPlaneDs.query(`DELETE FROM "org_memberships" WHERE organization_id = $1`, [orgAlphaId]);
        await controlPlaneDs.query(`DELETE FROM "organizations" WHERE organization_id = $1`, [orgAlphaId]);
      }
      if (orgBetaId) {
        await controlPlaneDs.query(`DELETE FROM "tenant_database_registry" WHERE organization_id = $1`, [orgBetaId]);
        await controlPlaneDs.query(`DELETE FROM "org_memberships" WHERE organization_id = $1`, [orgBetaId]);
        await controlPlaneDs.query(`DELETE FROM "organizations" WHERE organization_id = $1`, [orgBetaId]);
      }
      if (controlPlaneDs?.isInitialized) {
        await controlPlaneDs.query(`DELETE FROM "users" WHERE email LIKE '%@isolation-test.com'`);
        await controlPlaneDs.destroy();
      }
    } catch {}
  });

  // =========================================================================
  // 1. CONCURRENT ORGANIZATION CREATION & TENANT PROVISIONING
  // =========================================================================
  it('1. should concurrently create organizations and provision distinct tenant databases', async () => {
    const slugA = `iso-alpha-${Date.now().toString().slice(-6)}`;
    const slugB = `iso-beta-${Date.now().toString().slice(-6)}`;

    // Execute simultaneous organization creations
    const [resAlpha, resBeta] = await Promise.all([
      orgsService.createOrganization(userAlphaId, {
        name: 'Alpha University',
        slug: slugA,
        initialLibraryName: 'Alpha Main Campus',
      }),
      orgsService.createOrganization(userBetaId, {
        name: 'Beta Institute',
        slug: slugB,
        initialLibraryName: 'Beta Science Library',
      }),
    ]);

    orgAlphaId = resAlpha.organization.organizationId;
    orgBetaId = resBeta.organization.organizationId;
    libAlphaId = resAlpha.libraries[0].libraryId;
    libBetaId = resBeta.libraries[0].libraryId;

    const regA = await registryService.getRegistryEntry(orgAlphaId);
    const regB = await registryService.getRegistryEntry(orgBetaId);

    expect(regA).toBeDefined();
    expect(regB).toBeDefined();
    expect(regA!.database_name).not.toBe(regB!.database_name);
    dbAlphaName = regA!.database_name;
    dbBetaName = regB!.database_name;

    // Seed catalog in Alpha
    await catalogService.seedLibrary(orgAlphaId, libAlphaId);

    const catalogA = await catalogService.searchCatalog(orgAlphaId, libAlphaId, { limit: 1 });
    expect(catalogA.items.length).toBeGreaterThan(0);
    alphaBookId = catalogA.items[0].bookId;

    const bookDetailA = await catalogService.getBookDetails(orgAlphaId, libAlphaId, alphaBookId);
    expect(bookDetailA.editions).toBeDefined();
    alphaEditionId = bookDetailA.editions![0].editionId;

    // Create an Alpha-exclusive copy with a globally unique barcode
    const dsA = await connectionService.getTenantConnection(orgAlphaId);
    const alphaLocation = await dsA.query(
      `SELECT location_id FROM "locations" WHERE library_id = $1 AND location_type = 'SHELF' LIMIT 1`,
      [libAlphaId],
    );
    const alphaCopy = await catalogService.createCopy(orgAlphaId, libAlphaId, {
      editionId: alphaEditionId,
      homeLocationId: alphaLocation[0].location_id,
      barcode: `ALPHA-EXCL-${Date.now()}`,
      status: CopyStatus.AVAILABLE,
      condition: CopyCondition.GOOD,
    });
    alphaCopyBarcode = alphaCopy.barcode;
  }, 45000);

  // =========================================================================
  // 2. CONCURRENT 3-LIBRARY LIMIT ENFORCEMENT
  // =========================================================================
  it('2. should enforce the maximum 3-library limit under concurrent requests', async () => {
    // Org Alpha currently has 1 library. Add a 2nd library first.
    await orgsService.createLibrary(orgAlphaId, userAlphaId, {
      name: 'Alpha Branch Two',
      slug: 'alpha-branch-two',
    });

    // Now Org Alpha has 2 libraries. Exactly 1 slot remains before reaching the 3-library limit.
    // Launch 3 simultaneous concurrent requests trying to claim the remaining slot
    const concurrentAttempts = await Promise.allSettled([
      orgsService.createLibrary(orgAlphaId, userAlphaId, {
        name: 'Alpha Branch 3A',
        slug: 'alpha-branch-3a',
      }),
      orgsService.createLibrary(orgAlphaId, userAlphaId, {
        name: 'Alpha Branch 3B',
        slug: 'alpha-branch-3b',
      }),
      orgsService.createLibrary(orgAlphaId, userAlphaId, {
        name: 'Alpha Branch 3C',
        slug: 'alpha-branch-3c',
      }),
    ]);

    const fulfilled = concurrentAttempts.filter((r) => r.status === 'fulfilled');
    const rejected = concurrentAttempts.filter((r) => r.status === 'rejected');

    // Exactly one should succeed to claim the 3rd slot, while the other 2 must be rejected
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(2);

    // Verify total libraries count in tenant DB is strictly 3
    const finalDetails = await orgsService.getOrganizationDetails(orgAlphaId, userAlphaId);
    expect(finalDetails.libraries).toHaveLength(3);

    // A subsequent 4th attempt must also fail
    await expect(
      orgsService.createLibrary(orgAlphaId, userAlphaId, {
        name: 'Alpha Overflow Branch',
        slug: 'alpha-overflow',
      }),
    ).rejects.toThrow();
  });

  // =========================================================================
  // 3. CROSS-TENANT CATALOG & BOOK DENIAL
  // =========================================================================
  it('3. should deny cross-tenant access to books and editions', async () => {
    // AlphaBook exists in Org Alpha. Querying Org Beta with alphaBookId must throw NotFoundException
    await expect(
      catalogService.getBookDetails(orgBetaId, libBetaId, alphaBookId),
    ).rejects.toThrow(NotFoundException);

    // Catalog search in Beta must never include Alpha's bookId
    const searchBeta = await catalogService.searchCatalog(orgBetaId, libBetaId, {});
    const betaBookIds = searchBeta.items.map((b) => b.bookId);
    expect(betaBookIds).not.toContain(alphaBookId);
  });

  // =========================================================================
  // 4. CROSS-TENANT INVENTORY & PHYSICAL COPY DENIAL
  // =========================================================================
  it('4. should deny cross-tenant access to inventory copies', async () => {
    // Inventory search in Beta using Alpha barcode must return empty
    const invBeta = await catalogService.getInventory(orgBetaId, libBetaId, {
      search: alphaCopyBarcode,
    });
    expect(invBeta.total).toBe(0);
    expect(invBeta.items).toHaveLength(0);
  });

  // =========================================================================
  // 5. CROSS-TENANT CIRCULATION CHECKOUT & RETURN DENIAL
  // =========================================================================
  it('5. should deny cross-tenant checkout of copies belonging to another organization', async () => {
    // Attempting to checkout Alpha copy using Beta context must fail with NotFoundException
    await expect(
      circulationService.checkout(orgBetaId, libBetaId, userBetaId, {
        barcode: alphaCopyBarcode,
        readerUserId: userBetaId,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  // =========================================================================
  // 6. CROSS-TENANT RESERVATION & HOLD DENIAL
  // =========================================================================
  it('6. should deny cross-tenant reservations of editions in another organization', async () => {
    // Attempting to hold Alpha edition using Beta context must fail with NotFoundException
    await expect(
      circulationService.createReservation(orgBetaId, libBetaId, userBetaId, {
        editionId: alphaEditionId,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  // =========================================================================
  // 7. CROSS-TENANT WALLET & FINES ISOLATION
  // =========================================================================
  it('7. should isolate wallet balances and reject cross-tenant fine operations', async () => {
    // User Alpha tops up wallet in Org Alpha by ₹500
    const wAlpha = await walletService.topUp(orgAlphaId, libAlphaId, userAlphaId, {
      amount: 500,
      idempotencyKey: `topup-alpha-${Date.now()}`,
    });
    expect(wAlpha.wallet.balance).toBe(500);

    // User Alpha's wallet in Org Beta must have balance 0 (completely separate ledger)
    const wBeta = await walletService.getWallet(orgBetaId, libBetaId, userAlphaId);
    expect(wBeta.balance).toBe(0);

    // Assess a fine in Alpha
    const fineAlpha = await finesService.createManualFine(orgAlphaId, libAlphaId, userAlphaId, {
      readerUserId: userAlphaId,
      fineType: FineType.DAMAGE_FEE,
      amount: 150,
      notes: 'Damaged spine in Alpha',
    });

    // Attempting to pay or waive Alpha fine via Beta context must throw NotFoundException
    await expect(
      finesService.payFine(orgBetaId, libBetaId, userAlphaId, fineAlpha.fineId, {}),
    ).rejects.toThrow(NotFoundException);

    await expect(
      finesService.waiveFine(orgBetaId, libBetaId, userBetaId, fineAlpha.fineId, {
        reason: 'Attempted cross-tenant waiver',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  // =========================================================================
  // 8. CROSS-TENANT REVIEWS & SOCIAL LAYER DENIAL
  // =========================================================================
  it('8. should deny review submissions for books belonging to another tenant', async () => {
    // Attempting to review Alpha book using Beta orgId must fail
    await expect(
      communityService.createReview(orgBetaId, userBetaId, {
        bookId: alphaBookId,
        rating: 5,
        title: 'Cross-Tenant Review Attempt',
        body: 'This book belongs to Alpha, not Beta.',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  // =========================================================================
  // 9. CROSS-TENANT FLOOR PLAN & SPATIAL FIXTURES DENIAL
  // =========================================================================
  it('9. should deny cross-tenant access to floor plans and spatial drafts', async () => {
    // Create floor number 2 in Alpha (floor number 1 was already provisioned during demo seed)
    const floorAlpha = await floorPlanService.createFloor(orgAlphaId, libAlphaId, userAlphaId, {
      name: 'Alpha Level 2',
      floorNumber: 2,
    });
    alphaFloorId = floorAlpha.floorId;

    // Fetching Alpha floor using Beta context must throw NotFoundException
    await expect(
      floorPlanService.getFloor(orgBetaId, libBetaId, alphaFloorId),
    ).rejects.toThrow(NotFoundException);

    // Attempting to save draft elements into Alpha floor from Beta context must throw NotFoundException
    const draftAlpha = await floorPlanService.getOrCreateDraft(orgAlphaId, libAlphaId, alphaFloorId, userAlphaId);
    await expect(
      floorPlanService.saveDraft(orgBetaId, libBetaId, alphaFloorId, draftAlpha.versionId, userBetaId, {
        elements: [
          {
            elementType: 'WALL',
            x: 10,
            y: 10,
            width: 100,
            height: 20,
          },
        ],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  // =========================================================================
  // 10. ARCHITECTURAL SAFEGUARDS: NO SYNC & NO CREDENTIAL LEAKAGE
  // =========================================================================
  it('10. should guarantee synchronize: false and protect tenant database credentials', async () => {
    // 1. Control-plane DataSource has synchronize = false
    expect(controlPlaneDs.options.synchronize).toBe(false);

    // 2. Tenant DataSources have synchronize = false
    const dsA = await connectionService.getTenantConnection(orgAlphaId);
    expect(dsA.options.synchronize).toBe(false);

    const dsB = await connectionService.getTenantConnection(orgBetaId);
    expect(dsB.options.synchronize).toBe(false);

    // 3. OrganizationDetailsResponse does not leak database credentials
    const orgDetails = await orgsService.getOrganizationDetails(orgAlphaId, userAlphaId);
    expect((orgDetails as any).database_name).toBeUndefined();
    expect((orgDetails as any).connection_string).toBeUndefined();
    expect((orgDetails as any).password).toBeUndefined();
    expect((orgDetails as any).host).toBeUndefined();
    expect((orgDetails as any).port).toBeUndefined();

    for (const lib of orgDetails.libraries) {
      expect((lib as any).database_name).toBeUndefined();
      expect((lib as any).connection_string).toBeUndefined();
    }
  });
});

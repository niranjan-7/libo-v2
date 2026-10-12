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
import { CirculationService } from '../src/modules/circulation/circulation.service';
import { LoanStatus, ReservationStatus, CopyStatus, CopyCondition } from '@library/contracts';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('Circulation Engine Integration Tests', () => {
  let controlPlaneDs: DataSource;
  let registryService: TenantDatabaseRegistryService;
  let connectionService: TenantConnectionService;
  let authService: AuthService;
  let orgsService: OrganizationsService;
  let catalogService: CatalogService;
  let circulationService: CirculationService;
  let configService: ConfigService;

  let staffUserId: string;
  let reader1UserId: string;
  let reader2UserId: string;
  let reader3UserId: string;
  let testOrgId: string;
  let libraryId: string;
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
    circulationService = new CirculationService(connectionService);

    // Setup Staff & Reader Users
    const staffReg = await authService.register({
      email: `circulation-staff-${Date.now()}@library.test`,
      password: 'SecurePassword123!',
      displayName: 'Head Librarian',
    });
    staffUserId = staffReg.user.userId;

    const r1 = await authService.register({
      email: `reader1-${Date.now()}@library.test`,
      password: 'SecurePassword123!',
      displayName: 'Reader Alice',
    });
    reader1UserId = r1.user.userId;

    const r2 = await authService.register({
      email: `reader2-${Date.now()}@library.test`,
      password: 'SecurePassword123!',
      displayName: 'Reader Bob',
    });
    reader2UserId = r2.user.userId;

    const r3 = await authService.register({
      email: `reader3-${Date.now()}@library.test`,
      password: 'SecurePassword123!',
      displayName: 'Reader Charlie',
    });
    reader3UserId = r3.user.userId;

    // Create Organization & Provision Database
    const orgSlug = `circ-test-${Date.now()}`;
    const orgResult = await orgsService.createOrganization(staffUserId, {
      name: 'Circulation Testing Network',
      slug: orgSlug,
    });
    testOrgId = orgResult.organization.organizationId;

    const regEntry = await registryRepo.findOne({ where: { organization_id: testOrgId } });
    provisionedDbName = regEntry?.database_name || '';

    // Create Library
    const lib = await orgsService.createLibrary(testOrgId, staffUserId, {
      name: 'Main Lending Library',
      slug: 'main-lending',
    });
    libraryId = lib.libraryId;

    // Seed Library Catalog (8 books, 8 editions, physical copies)
    await catalogService.seedLibrary(testOrgId, libraryId);
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
      if (controlPlaneDs?.isInitialized) {
        await controlPlaneDs.query(`DELETE FROM "users" WHERE email LIKE '%@library.test'`);
        await controlPlaneDs.destroy();
      }
    } catch {}
  });

  describe('1. Walk-in Checkout & Concurrency Controls', () => {
    it('should perform walk-in checkout without a reservation and set status to LOANED', async () => {
      // Midnight Library copy CP-00142 is initially AVAILABLE
      const loan = await circulationService.checkout(testOrgId, libraryId, staffUserId, {
        barcode: 'CP-00142',
        readerUserId: reader1UserId,
      });

      expect(loan.barcode).toBe('CP-00142');
      expect(loan.readerUserId).toBe(reader1UserId);
      expect(loan.status).toBe(LoanStatus.ACTIVE);
      expect(loan.extensionCount).toBe(0);

      // Verify default loan period is 21 days
      const due = new Date(loan.dueAt).getTime();
      const out = new Date(loan.checkedOutAt).getTime();
      const diffDays = Math.round((due - out) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(21);

      // Verify copy state in database
      const tenantDs = await connectionService.getTenantConnection(testOrgId);
      const copyRows = await tenantDs.query(
        `SELECT status, current_location_id FROM "book_copies" WHERE barcode = 'CP-00142' AND library_id = $1`,
        [libraryId],
      );
      expect(copyRows[0].status).toBe(CopyStatus.LOANED);
      expect(copyRows[0].current_location_id).toBeNull();
    });

    it('should reject double submission / second checkout on already loaned copy', async () => {
      // Trying to check out CP-00142 again while it is LOANED must throw ConflictException
      await expect(
        circulationService.checkout(testOrgId, libraryId, staffUserId, {
          barcode: 'CP-00142',
          readerUserId: reader2UserId,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should prevent concurrent checkouts of the same copy using row-level locking', async () => {
      // CP-00143 is AVAILABLE
      const [res1, res2] = await Promise.allSettled([
        circulationService.checkout(testOrgId, libraryId, staffUserId, {
          barcode: 'CP-00143',
          readerUserId: reader1UserId,
        }),
        circulationService.checkout(testOrgId, libraryId, staffUserId, {
          barcode: 'CP-00143',
          readerUserId: reader2UserId,
        }),
      ]);

      // Exactly one must succeed, and exactly one must fail with ConflictException
      const fulfilled = [res1, res2].filter((r) => r.status === 'fulfilled');
      const rejected = [res1, res2].filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    });
  });

  describe('2. Loan Extensions & Overdue Rules', () => {
    let targetLoanId: string;

    it('should extend an active loan by 7 days increment', async () => {
      const activeLoans = await circulationService.getLoans(testOrgId, libraryId, {
        readerUserId: reader1UserId,
        status: LoanStatus.ACTIVE,
      });
      const loan = activeLoans.items[0];
      targetLoanId = loan.loanId;

      const initialDue = new Date(loan.dueAt).getTime();
      const extended = await circulationService.extendLoan(testOrgId, libraryId, reader1UserId, targetLoanId);

      expect(extended.extensionCount).toBe(1);
      const extendedDue = new Date(extended.dueAt).getTime();
      const diffDays = Math.round((extendedDue - initialDue) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(7); // default extension increment 7 days
    });

    it('should allow second extension up to max extensions limit (2)', async () => {
      const extended = await circulationService.extendLoan(testOrgId, libraryId, reader1UserId, targetLoanId);
      expect(extended.extensionCount).toBe(2);

      // Third extension attempt must throw BadRequestException (max 2 extensions exceeded)
      await expect(
        circulationService.extendLoan(testOrgId, libraryId, reader1UserId, targetLoanId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prohibit extending an overdue loan', async () => {
      const activeLoans = await circulationService.getLoans(testOrgId, libraryId, {
        readerUserId: reader1UserId,
        status: LoanStatus.ACTIVE,
      });
      const loan = activeLoans.items.find((l) => l.barcode === 'CP-00143')!;

      // Artificially manipulate due_at to past in database
      const tenantDs = await connectionService.getTenantConnection(testOrgId);
      await tenantDs.query(
        `UPDATE "loans" SET due_at = NOW() - INTERVAL '3 days' WHERE loan_id = $1`,
        [loan.loanId],
      );

      await expect(
        circulationService.extendLoan(testOrgId, libraryId, reader1UserId, loan.loanId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Returns & Automatic Reservation Allocation', () => {
    let duneEditionId: string;

    beforeAll(async () => {
      const tenantDs = await connectionService.getTenantConnection(testOrgId);
      const edRows = await tenantDs.query(
        `SELECT e.edition_id FROM "book_editions" e
         JOIN "books" b ON b.book_id = e.book_id
         WHERE b.title = 'Project Hail Mary' LIMIT 1`,
      );
      duneEditionId = edRows[0].edition_id;
    });

    it('should place Reader 2 on waitlist for Project Hail Mary (CP-00201 is on loan)', async () => {
      // First checkout CP-00201 to reader 1
      await circulationService.checkout(testOrgId, libraryId, staffUserId, {
        barcode: 'CP-00201',
        readerUserId: reader1UserId,
      });

      // Reader 2 places reservation; since 0 copies are available, gets placed on WAITLISTED
      const res = await circulationService.createReservation(testOrgId, libraryId, reader2UserId, {
        editionId: duneEditionId,
      });

      expect(res.status).toBe(ReservationStatus.WAITLISTED);
      expect(res.assignedCopyId).toBeNull();
      expect(res.queuePosition).toBe(1);
    });

    it('should place Reader 3 second in the FIFO waitlist queue', async () => {
      const res3 = await circulationService.createReservation(testOrgId, libraryId, reader3UserId, {
        editionId: duneEditionId,
      });

      expect(res3.status).toBe(ReservationStatus.WAITLISTED);
      expect(res3.assignedCopyId).toBeNull();
      expect(res3.queuePosition).toBe(2);
    });

    it('should atomically assign returned copy to Reader 2 (first in FIFO queue) and place copy ON_HOLD', async () => {
      // Return CP-00201
      const returnResult = await circulationService.returnCopy(testOrgId, libraryId, staffUserId, {
        barcode: 'CP-00201',
        condition: CopyCondition.GOOD,
      });

      expect(returnResult.loan?.status).toBe(LoanStatus.RETURNED);
      expect(returnResult.copyStatus).toBe(CopyStatus.ON_HOLD);
      expect(returnResult.nextReservation).toBeDefined();
      expect(returnResult.nextReservation?.readerUserId).toBe(reader2UserId); // FIFO order: Reader 2 got it!
      expect(returnResult.nextReservation?.status).toBe(ReservationStatus.ALLOCATED);

      // Verify copy state in database
      const tenantDs = await connectionService.getTenantConnection(testOrgId);
      const copyRows = await tenantDs.query(
        `SELECT status FROM "book_copies" WHERE barcode = 'CP-00201' AND library_id = $1`,
        [libraryId],
      );
      expect(copyRows[0].status).toBe(CopyStatus.ON_HOLD);
    });

    it('should prohibit loan extension when another reader has reserved the title', async () => {
      // Check out a book that has a reservation waitlist
      // CP-00121 (Educated)
      const tenantDs = await connectionService.getTenantConnection(testOrgId);
      const edRows = await tenantDs.query(
        `SELECT e.edition_id FROM "book_editions" e
         JOIN "books" b ON b.book_id = e.book_id
         WHERE b.title = 'Educated' LIMIT 1`,
      );
      const educatedEdId = edRows[0].edition_id;

      // Checkout to reader 1
      const loan = await circulationService.checkout(testOrgId, libraryId, staffUserId, {
        barcode: 'CP-00121',
        readerUserId: reader1UserId,
      });

      // Reader 3 waitlists Educated
      await circulationService.createReservation(testOrgId, libraryId, reader3UserId, {
        editionId: educatedEdId,
      });

      // Reader 1 attempts to extend: must fail with ConflictException because reader 3 is waiting!
      await expect(
        circulationService.extendLoan(testOrgId, libraryId, reader1UserId, loan.loanId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('4. Pickup-Ready Workflow & 72-Hour Countdown Expiry', () => {
    let allocatedReservationId: string;

    beforeAll(async () => {
      // Get Reader 2's ALLOCATED reservation for Project Hail Mary
      const reservations = await circulationService.getReservations(testOrgId, libraryId, {
        readerUserId: reader2UserId,
        status: ReservationStatus.ALLOCATED,
      });
      allocatedReservationId = reservations.items[0].reservationId;
    });

    it('should start the 72-hour default pickup countdown only after confirmed ready for pickup', async () => {
      const readyRes = await circulationService.markReadyForPickup(
        testOrgId,
        libraryId,
        staffUserId,
        allocatedReservationId,
        {},
      );

      expect(readyRes.status).toBe(ReservationStatus.READY_FOR_PICKUP);
      expect(readyRes.readyAt).toBeDefined();
      expect(readyRes.pickupDeadlineAt).toBeDefined();

      const readyTime = new Date(readyRes.readyAt!).getTime();
      const deadline = new Date(readyRes.pickupDeadlineAt!).getTime();
      const diffHours = Math.round((deadline - readyTime) / (1000 * 60 * 60));
      expect(diffHours).toBe(72); // 72-hour default pickup window
    });

    it('should fulfill the reservation and checkout the copy to the holding reader', async () => {
      const loan = await circulationService.checkout(testOrgId, libraryId, staffUserId, {
        barcode: 'CP-00201',
        readerUserId: reader2UserId,
        reservationId: allocatedReservationId,
      });

      expect(loan.status).toBe(LoanStatus.ACTIVE);
      expect(loan.reservationId).toBe(allocatedReservationId);

      // Verify reservation is FULFILLED
      const tenantDs = await connectionService.getTenantConnection(testOrgId);
      const resRows = await tenantDs.query(
        `SELECT status, fulfilled_at FROM "reservations" WHERE reservation_id = $1`,
        [allocatedReservationId],
      );
      expect(resRows[0].status).toBe(ReservationStatus.FULFILLED);
      expect(resRows[0].fulfilled_at).toBeDefined();
    });

    it('should safely and idempotently expire a past-deadline hold and reassign copy to next in queue', async () => {
      // 1. Reader 2 returns CP-00201
      await circulationService.returnCopy(testOrgId, libraryId, staffUserId, {
        barcode: 'CP-00201',
      });

      // Reader 3 was next in queue, so Reader 3 gets it ALLOCATED!
      const r3Res = await circulationService.getReservations(testOrgId, libraryId, {
        readerUserId: reader3UserId,
        status: ReservationStatus.ALLOCATED,
      });
      const res3 = r3Res.items[0];

      // Mark ready for pickup
      await circulationService.markReadyForPickup(testOrgId, libraryId, staffUserId, res3.reservationId, {});

      // Artificially make pickup_deadline_at expired in database
      const tenantDs = await connectionService.getTenantConnection(testOrgId);
      await tenantDs.query(
        `UPDATE "reservations" SET pickup_deadline_at = NOW() - INTERVAL '1 hour' WHERE reservation_id = $1`,
        [res3.reservationId],
      );

      // Run expiry processor
      const sweep = await circulationService.processExpiries(testOrgId, libraryId);
      expect(sweep.expiredCount).toBe(1);

      // Verify reservation is marked EXPIRED
      const checkRes = await tenantDs.query(
        `SELECT status FROM "reservations" WHERE reservation_id = $1`,
        [res3.reservationId],
      );
      expect(checkRes[0].status).toBe(ReservationStatus.EXPIRED);

      // Verify copy is restored to AVAILABLE because no more waitlists exist
      const copyRows = await tenantDs.query(
        `SELECT status FROM "book_copies" WHERE copy_id = $1`,
        [res3.assignedCopyId],
      );
      expect(copyRows[0].status).toBe(CopyStatus.AVAILABLE);

      // Running expiry processor again must be completely idempotent (0 expired)
      const sweep2 = await circulationService.processExpiries(testOrgId, libraryId);
      expect(sweep2.expiredCount).toBe(0);
    });
  });

  describe('5. Limit Enforcement & Branch Policy Configuration', () => {
    it('should enforce active loan limit (5 loans per reader) and reject additional checkout', async () => {
      // Check reader 1's active loans
      const active = await circulationService.getLoans(testOrgId, libraryId, {
        readerUserId: reader1UserId,
        status: LoanStatus.ACTIVE,
      });

      // Seed enough copies to reach 5 active loans
      const tenantDs = await connectionService.getTenantConnection(testOrgId);
      const remainingNeeded = 5 - active.items.length;

      // Create new copies and check them out until reader 1 hits 5
      const edRows = await tenantDs.query(`SELECT edition_id FROM "book_editions" LIMIT 1`);
      const edId = edRows[0].edition_id;

      for (let i = 1; i <= remainingNeeded; i++) {
        const barcode = `CP-LIM-${Date.now()}-${i}`;
        await catalogService.createCopy(testOrgId, libraryId, {
          editionId: edId,
          barcode,
          condition: CopyCondition.GOOD,
          status: CopyStatus.AVAILABLE,
          homeLocationId: (await tenantDs.query(`SELECT location_id FROM "locations" WHERE location_type = 'SHELF' LIMIT 1`))[0].location_id,
        });

        await circulationService.checkout(testOrgId, libraryId, staffUserId, {
          barcode,
          readerUserId: reader1UserId,
        });
      }

      // Now reader 1 has exactly 5 active loans.
      // Attempting the 6th checkout must throw BadRequestException
      const extraBarcode = `CP-EXTRA-${Date.now()}`;
      await catalogService.createCopy(testOrgId, libraryId, {
        editionId: edId,
        barcode: extraBarcode,
        condition: CopyCondition.GOOD,
        status: CopyStatus.AVAILABLE,
        homeLocationId: (await tenantDs.query(`SELECT location_id FROM "locations" WHERE location_type = 'SHELF' LIMIT 1`))[0].location_id,
      });

      await expect(
        circulationService.checkout(testOrgId, libraryId, staffUserId, {
          barcode: extraBarcode,
          readerUserId: reader1UserId,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should enforce pending reservations limit (3 holds per reader)', async () => {
      const tenantDs = await connectionService.getTenantConnection(testOrgId);
      const edRows = await tenantDs.query(`SELECT edition_id FROM "book_editions" LIMIT 4`);

      // Cancel any active holds for reader 3 first
      await tenantDs.query(
        `UPDATE "reservations" SET status = 'CANCELLED' WHERE reader_user_id = $1 AND status IN ('WAITLISTED', 'ALLOCATED', 'READY_FOR_PICKUP')`,
        [reader3UserId],
      );

      // Create 3 reservations for different editions
      await circulationService.createReservation(testOrgId, libraryId, reader3UserId, { editionId: edRows[0].edition_id });
      await circulationService.createReservation(testOrgId, libraryId, reader3UserId, { editionId: edRows[1].edition_id });
      await circulationService.createReservation(testOrgId, libraryId, reader3UserId, { editionId: edRows[2].edition_id });

      // 4th reservation must throw BadRequestException (limit 3 reached)
      await expect(
        circulationService.createReservation(testOrgId, libraryId, reader3UserId, { editionId: edRows[3].edition_id }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update circulation policy dynamically without hardcoding currency or fine rate', async () => {
      const updatedPolicy = await circulationService.updateCirculationPolicy(
        testOrgId,
        libraryId,
        staffUserId,
        {
          loanPeriodDays: 28,
          extensionIncrementDays: 14,
          maxExtensions: 3,
          maxActiveLoans: 8,
          currencyCode: 'INR',
          dailyOverdueFineRate: 25.0,
        },
      );

      expect(updatedPolicy.loanPeriodDays).toBe(28);
      expect(updatedPolicy.extensionIncrementDays).toBe(14);
      expect(updatedPolicy.maxExtensions).toBe(3);
      expect(updatedPolicy.maxActiveLoans).toBe(8);
      expect(updatedPolicy.dailyOverdueFineRate).toBe(25.0);
      expect(updatedPolicy.currencyCode).toBe('INR');

      const fetched = await circulationService.getCirculationPolicy(testOrgId, libraryId);
      expect(fetched.loanPeriodDays).toBe(28);
      expect(fetched.dailyOverdueFineRate).toBe(25.0);
    });
  });
});

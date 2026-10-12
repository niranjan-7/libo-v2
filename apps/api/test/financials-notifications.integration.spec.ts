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
import { AuditService } from '../src/modules/audit/audit.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { WalletService } from '../src/modules/wallet/wallet.service';
import { FinesService } from '../src/modules/fines/fines.service';
import { BackgroundJobsService } from '../src/modules/jobs/background-jobs.service';
import { FineStatus, FineType, LedgerDirection, WalletTransactionType } from '@library/contracts';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('Financial Ledger, Fines, Notifications & Background Processing Integration Tests', () => {
  let controlPlaneDs: DataSource;
  let registryService: TenantDatabaseRegistryService;
  let connectionService: TenantConnectionService;
  let authService: AuthService;
  let orgsService: OrganizationsService;
  let catalogService: CatalogService;
  let auditService: AuditService;
  let notificationsService: NotificationsService;
  let walletService: WalletService;
  let finesService: FinesService;
  let circulationService: CirculationService;
  let jobsService: BackgroundJobsService;
  let configService: ConfigService;

  let staffUserId: string;
  let readerUserId: string;
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
    auditService = new AuditService(connectionService);
    notificationsService = new NotificationsService(connectionService);
    walletService = new WalletService(connectionService, notificationsService, auditService);
    finesService = new FinesService(connectionService, notificationsService, auditService, walletService);
    circulationService = new CirculationService(connectionService, notificationsService, auditService);
    jobsService = new BackgroundJobsService(
      finesService,
      circulationService,
      notificationsService,
      auditService,
    );

    // Setup Staff & Reader Users
    const staffReg = await authService.register({
      email: `financial-staff-${Date.now()}@library.test`,
      password: 'SecurePassword123!',
      displayName: 'Finance Admin',
    });
    staffUserId = staffReg.user.userId;

    const readerReg = await authService.register({
      email: `financial-reader-${Date.now()}@library.test`,
      password: 'SecurePassword123!',
      displayName: 'Reader Fin',
    });
    readerUserId = readerReg.user.userId;

    // Create Organization & Provision Dedicated Tenant Database
    const orgSlug = `fin-test-${Date.now()}`;
    const orgResult = await orgsService.createOrganization(staffUserId, {
      name: 'Financial Services Testing Org',
      slug: orgSlug,
    });
    testOrgId = orgResult.organization.organizationId;

    const regEntry = await registryRepo.findOne({ where: { organization_id: testOrgId } });
    provisionedDbName = regEntry?.database_name || '';

    // Create Branch Library
    const lib = await orgsService.createLibrary(testOrgId, staffUserId, {
      name: 'Central Financial Branch',
      slug: 'central-fin',
    });
    libraryId = lib.libraryId;

    // Seed Catalog Items for loan tests
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

  describe('1. Append-Only Wallet Ledger & Simulated Top-Ups', () => {
    it('should initialize empty wallet balance at zero', async () => {
      const wallet = await walletService.getWallet(testOrgId, libraryId, readerUserId);
      expect(wallet).toBeDefined();
      expect(wallet.balance).toBe(0);
      expect(wallet.currencyCode).toBe('INR');

      const txHistory = await walletService.getTransactions(testOrgId, libraryId, readerUserId);
      expect(txHistory.items).toHaveLength(0);
      expect(txHistory.total).toBe(0);
    });

    it('should append a CREDIT transaction and update balance on simulated top-up', async () => {
      const topUpResult = await walletService.topUp(testOrgId, libraryId, readerUserId, {
        amount: 500,
        idempotencyKey: 'idem-topup-1',
        notes: 'Initial pocket top-up',
      });

      expect(topUpResult.transaction.direction).toBe(LedgerDirection.CREDIT);
      expect(topUpResult.transaction.amount).toBe(500);
      expect(topUpResult.wallet.balance).toBe(500);

      const updatedWallet = await walletService.getWallet(testOrgId, libraryId, readerUserId);
      expect(updatedWallet.balance).toBe(500);
    });

    it('should idempotently handle duplicate top-up submissions with same idempotencyKey', async () => {
      // Re-submit the exact same top-up with 'idem-topup-1'
      const duplicateResult = await walletService.topUp(testOrgId, libraryId, readerUserId, {
        amount: 500,
        idempotencyKey: 'idem-topup-1',
        notes: 'Duplicate request should not double charge',
      });

      expect(duplicateResult.transaction.direction).toBe(LedgerDirection.CREDIT);
      expect(duplicateResult.wallet.balance).toBe(500); // Balance NOT doubled!

      const txHistory = await walletService.getTransactions(testOrgId, libraryId, readerUserId);
      expect(txHistory.items).toHaveLength(1); // Only 1 transaction recorded
    });

    it('should append subsequent top-ups and accurately track ledger history', async () => {
      await walletService.topUp(testOrgId, libraryId, readerUserId, {
        amount: 250,
        idempotencyKey: 'idem-topup-2',
        notes: 'Second top-up',
      });

      const wallet = await walletService.getWallet(testOrgId, libraryId, readerUserId);
      expect(wallet.balance).toBe(750);

      const txHistory = await walletService.getTransactions(testOrgId, libraryId, readerUserId);
      expect(txHistory.items).toHaveLength(2);
      expect(txHistory.items[0].amount).toBe(250);
      expect(txHistory.items[1].amount).toBe(500);
    });
  });

  describe('2. Fine Debts Distinct from Payments & Wallet Settlement', () => {
    let damageFineId: string;

    it('should record manual fine as an UNPAID debt liability without deducting from wallet', async () => {
      const fine = await finesService.createManualFine(testOrgId, libraryId, staffUserId, {
        readerUserId,
        fineType: FineType.DAMAGE_FEE,
        amount: 200,
        notes: 'Torn back cover on returned book',
      });

      expect(fine.fineId).toBeDefined();
      expect(fine.status).toBe(FineStatus.UNPAID);
      expect(fine.amount).toBe(200);
      expect(fine.outstandingAmount).toBe(200);
      damageFineId = fine.fineId;

      // Wallet balance must remain unaffected by the fine assessment
      const wallet = await walletService.getWallet(testOrgId, libraryId, readerUserId);
      expect(wallet.balance).toBe(750);

      // Verify fine queries
      const finesList = await finesService.getFines(testOrgId, libraryId, { readerUserId });
      expect(finesList.items).toHaveLength(1);
      expect(finesList.totalOutstanding).toBe(200);
    });

    it('should settle fine debt from reader wallet, creating an append-only DEBIT ledger entry', async () => {
      const settlement = await finesService.payFine(testOrgId, libraryId, readerUserId, damageFineId, {
        idempotencyKey: 'idem-settle-damage-1',
      });

      expect(settlement.fine.status).toBe(FineStatus.PAID);
      expect(settlement.fine.outstandingAmount).toBe(0);
      expect(settlement.newWalletBalance).toBe(550); // 750 - 200 = 550

      // Ledger now has 3 append-only records: 2 topups, 1 fine debit
      const txHistory = await walletService.getTransactions(testOrgId, libraryId, readerUserId);
      expect(txHistory.items).toHaveLength(3);
      expect(txHistory.items[0].direction).toBe(LedgerDirection.DEBIT);
      expect(txHistory.items[0].transactionType).toBe(WalletTransactionType.FINE_SETTLEMENT);
      expect(txHistory.items[0].fineId).toBe(damageFineId);

      // Outstanding fines for reader is now 0
      const finesList = await finesService.getFines(testOrgId, libraryId, { readerUserId });
      expect(finesList.totalOutstanding).toBe(0);
    });

    it('should reject paying an already settled fine', async () => {
      await expect(
        finesService.payFine(testOrgId, libraryId, readerUserId, damageFineId, {
          idempotencyKey: 'idem-settle-damage-duplicate',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject paying a fine if wallet balance is insufficient', async () => {
      // Create a massive fine of 1500 INR (reader only has 550 INR balance)
      const hugeFine = await finesService.createManualFine(testOrgId, libraryId, staffUserId, {
        readerUserId,
        fineType: FineType.LOST_ITEM,
        amount: 1500,
        notes: 'Lost hardcover encyclopedia',
      });

      await expect(
        finesService.payFine(testOrgId, libraryId, readerUserId, hugeFine.fineId, {
          idempotencyKey: 'idem-settle-huge-1',
        }),
      ).rejects.toThrow(BadRequestException);

      // Verify balance did not change and fine is still UNPAID
      const wallet = await walletService.getWallet(testOrgId, libraryId, readerUserId);
      expect(wallet.balance).toBe(550);

      const fineCheck = await finesService.getFineById(testOrgId, libraryId, hugeFine.fineId);
      expect(fineCheck.status).toBe(FineStatus.UNPAID);
    });
  });

  describe('3. Idempotent Overdue Fine Generation', () => {
    let overdueLoanId: string;

    beforeAll(async () => {
      // Create a loan and artificially set due_at in the past
      const tenantDs = await connectionService.getTenantConnection(testOrgId);
      const copyRows = await tenantDs.query(
        `SELECT copy_id FROM "book_copies" WHERE library_id = $1 AND status = 'AVAILABLE' LIMIT 1`,
        [libraryId],
      );
      const copyId = copyRows[0].copy_id;

      const [loan] = await tenantDs.query(
        `INSERT INTO "loans" (
          "library_id", "copy_id", "reader_user_id", "checked_out_by_user_id", "checked_out_at", "due_at", "status", "extension_count"
        ) VALUES ($1, $2, $3, $4, NOW() - interval '10 days', NOW() - interval '3 days', 'OVERDUE', 0)
        RETURNING *`,
        [libraryId, copyId, readerUserId, staffUserId],
      );
      overdueLoanId = loan.loan_id;
    });

    it('should generate daily overdue fines for overdue loans', async () => {
      const result = await finesService.generateOverdueFines(testOrgId, libraryId);
      expect(result.loansCheckedCount).toBeGreaterThanOrEqual(1);
      expect(result.finesGeneratedCount).toBeGreaterThanOrEqual(1);

      // Check fine record
      const fines = await finesService.getFines(testOrgId, libraryId, {
        loanId: overdueLoanId,
        fineType: FineType.OVERDUE_DAILY,
      });
      expect(fines.items.length).toBeGreaterThanOrEqual(1);
      expect(fines.items[0].status).toBe(FineStatus.UNPAID);
      expect(fines.items[0].amount).toBe(10); // Default branch policy: 10 INR/day
    });

    it('should be idempotent and not create duplicate fines for the same reader/copy/day', async () => {
      // Re-run the sweep immediately
      const secondSweep = await finesService.generateOverdueFines(testOrgId, libraryId);
      expect(secondSweep.finesGeneratedCount).toBe(0); // 0 duplicate fines generated!

      const fines = await finesService.getFines(testOrgId, libraryId, {
        loanId: overdueLoanId,
        fineType: FineType.OVERDUE_DAILY,
      });
      // Exactly 3 daily fines generated for the 3 overdue days, no duplicates
      expect(fines.items.length).toBe(3);
    });

    it('should preserve accrued fines when a loan extension occurs', async () => {
      // Verify the overdue fine is still UNPAID
      const beforeFines = await finesService.getFines(testOrgId, libraryId, { loanId: overdueLoanId });
      expect(beforeFines.items[0].status).toBe(FineStatus.UNPAID);

      // Artificially simulate staff granting a due date update on the loan
      const tenantDs = await connectionService.getTenantConnection(testOrgId);
      await tenantDs.query(
        `UPDATE "loans" SET "due_at" = NOW() + interval '7 days', "extension_count" = 1 WHERE "loan_id" = $1`,
        [overdueLoanId],
      );

      // Specification rule: An extension must NOT erase already accrued fines
      const afterFines = await finesService.getFines(testOrgId, libraryId, { loanId: overdueLoanId });
      expect(afterFines.items[0].status).toBe(FineStatus.UNPAID);
      expect(afterFines.items[0].outstandingAmount).toBe(10);
    });
  });

  describe('4. Fine Waivers & Mandatory Audit Trail', () => {
    let waiverFineId: string;

    beforeAll(async () => {
      const fine = await finesService.createManualFine(testOrgId, libraryId, staffUserId, {
        readerUserId,
        fineType: FineType.LOST_ITEM,
        amount: 80,
        notes: 'Small scratch on plastic cover',
      });
      waiverFineId = fine.fineId;
    });

    it('should reject fine waiver when reason is missing or empty', async () => {
      await expect(
        finesService.waiveFine(testOrgId, libraryId, staffUserId, waiverFineId, {
          reason: '   ',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should record fine waiver with actor, non-empty reason, timestamp, and audit trail', async () => {
      const waivedFine = await finesService.waiveFine(testOrgId, libraryId, staffUserId, waiverFineId, {
        reason: 'Courtesy waiver granted for university student during exam week',
      });

      expect(waivedFine.status).toBe(FineStatus.WAIVED);
      expect(waivedFine.outstandingAmount).toBe(0);

      // Verify wallet was NOT debited
      const wallet = await walletService.getWallet(testOrgId, libraryId, readerUserId);
      expect(wallet.balance).toBe(550); // Unchanged

      // Verify audit log entry was written
      const auditLogs = await auditService.queryLogs(testOrgId, {
        entityType: 'FINE',
        entityId: waiverFineId,
        action: 'WAIVE_FINE',
      });

      expect(auditLogs.items).toHaveLength(1);
      expect(auditLogs.items[0].actorUserId).toBe(staffUserId);
      expect(auditLogs.items[0].newValue?.reason).toContain('Courtesy waiver granted');
    });

    it('should reject waiving an already waived fine', async () => {
      await expect(
        finesService.waiveFine(testOrgId, libraryId, staffUserId, waiverFineId, {
          reason: 'Attempting to re-waive',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('5. Notifications Inbox, Delivery Records & Observable Failures', () => {
    it('should create notifications with dedupeKey idempotency and track deliveries', async () => {
      const n1 = await notificationsService.createNotification(testOrgId, {
        userId: readerUserId,
        libraryId,
        eventType: 'RESERVATION_READY_FOR_PICKUP',
        title: 'Your Book is Ready!',
        body: 'Please collect "Dune" within 72 hours from Main Stacks.',
        dedupeKey: `notif-test-${readerUserId}-1`,
        payload: { title: 'Dune', hoursLeft: 72 },
      });

      expect(n1.notificationId).toBeDefined();
      expect(n1.title).toBe('Your Book is Ready!');
      expect(n1.readAt).toBeFalsy();

      // Duplicate call with same dedupeKey returns existing notification without creating another row
      const n2 = await notificationsService.createNotification(testOrgId, {
        userId: readerUserId,
        libraryId,
        eventType: 'RESERVATION_READY_FOR_PICKUP',
        title: 'Your Book is Ready!',
        body: 'Please collect "Dune" within 72 hours from Main Stacks.',
        dedupeKey: `notif-test-${readerUserId}-1`,
      });
      expect(n2.notificationId).toBe(n1.notificationId);

      // Query inbox
      const inbox = await notificationsService.getUserNotifications(testOrgId, readerUserId);
      expect(inbox.unreadCount).toBeGreaterThanOrEqual(1);

      // Mark notification as read
      const updated = await notificationsService.markAsRead(testOrgId, readerUserId, n1.notificationId);
      expect(updated.readAt).toBeDefined();
    });

    it('should process pending notification deliveries and record retry tracking', async () => {
      // Process deliveries (in-app and email channels)
      const deliveryResult = await notificationsService.processDeliveries(testOrgId);
      expect(deliveryResult.processedCount).toBeGreaterThanOrEqual(1);

      // Check delivery records in database
      const tenantDs = await connectionService.getTenantConnection(testOrgId);
      const deliveryRows = await tenantDs.query(
        `SELECT * FROM "notification_deliveries" WHERE status = 'SENT'`,
      );
      expect(deliveryRows.length).toBeGreaterThanOrEqual(1);
      expect(deliveryRows[0].attempt_count).toBeGreaterThanOrEqual(1);
      expect(deliveryRows[0].sent_at).toBeDefined();
    });
  });

  describe('6. Background Jobs Mutex Lock & Duplicate Execution Prevention', () => {
    it('should prevent duplicate concurrent execution of the same background job', async () => {
      // Running overdue fine sweep
      const sweepPromise1 = jobsService.runOverdueFineSweep(testOrgId, libraryId);

      // Simultaneous execution must be rejected with ConflictException due to running mutex lock
      await expect(
        jobsService.runOverdueFineSweep(testOrgId, libraryId),
      ).rejects.toThrow(ConflictException);

      // Await first sweep completion
      const sweep1 = await sweepPromise1;
      expect(sweep1.success).toBe(true);

      // After completion, the mutex lock is released and running again is allowed
      const sweep2 = await jobsService.runOverdueFineSweep(testOrgId, libraryId);
      expect(sweep2.success).toBe(true);
    });

    it('should execute hold expiry and notification delivery sweeps cleanly', async () => {
      const expirySweep = await jobsService.runHoldExpirySweep(testOrgId, libraryId);
      expect(expirySweep.jobName).toBe('HOLD_EXPIRY_SWEEP');
      expect(expirySweep.success).toBe(true);

      const deliverySweep = await jobsService.runNotificationDeliverySweep(testOrgId, libraryId);
      expect(deliverySweep.jobName).toBe('NOTIFICATION_DELIVERY_SWEEP');
      expect(deliverySweep.success).toBe(true);
    });
  });
});

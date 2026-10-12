import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { TenantConnectionService } from '../tenant-connection/tenant-connection.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import {
  CirculationPolicyDto,
  LoanDto,
  ReservationDto,
  CirculationDeskStatsResponse,
  LoanStatus,
  ReservationStatus,
  CopyStatus,
  CopyCondition,
} from '@library/contracts';
import {
  CheckoutDto,
  ReturnDto,
  CreateReservationDto,
  ReadyForPickupDto,
  UpdateCirculationPolicyDto,
  LoansQueryDto,
  ReservationsQueryDto,
} from './dto/circulation.dto';

const DEFAULT_POLICY: CirculationPolicyDto = {
  loanPeriodDays: 21,
  extensionIncrementDays: 7,
  maxExtensions: 2,
  maxActiveLoans: 5,
  maxPendingReservations: 3,
  pickupWindowHours: 72,
  currencyCode: 'INR',
  dailyOverdueFineRate: 10.0,
};

@Injectable()
export class CirculationService {
  private readonly logger = new Logger(CirculationService.name);

  constructor(
    private readonly tenantConnectionService: TenantConnectionService,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  private extractRow<T = any>(result: any): T {
    if (!result) return {} as T;
    if (Array.isArray(result)) {
      if (Array.isArray(result[0])) {
        return (result[0][0] || {}) as T;
      }
      return (result[0] || {}) as T;
    }
    return result as T;
  }

  /**
   * Retrieves circulation policy for a specific library branch.
   */
  async getCirculationPolicy(
    organizationId: string,
    libraryId: string,
  ): Promise<CirculationPolicyDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    return this.getCirculationPolicyWithManager(tenantDs.manager, libraryId);
  }

  private async getCirculationPolicyWithManager(
    manager: EntityManager,
    libraryId: string,
  ): Promise<CirculationPolicyDto> {
    const rows = await manager.query(
      `SELECT "value" FROM "library_settings" WHERE "library_id" = $1 AND "setting_key" = 'circulation_policy'`,
      [libraryId],
    );

    if (rows.length === 0 || !rows[0].value) {
      return { ...DEFAULT_POLICY };
    }

    const val = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
    return {
      loanPeriodDays: val.loanPeriodDays ?? DEFAULT_POLICY.loanPeriodDays,
      extensionIncrementDays: val.extensionIncrementDays ?? DEFAULT_POLICY.extensionIncrementDays,
      maxExtensions: val.maxExtensions ?? DEFAULT_POLICY.maxExtensions,
      maxActiveLoans: val.maxActiveLoans ?? DEFAULT_POLICY.maxActiveLoans,
      maxPendingReservations: val.maxPendingReservations ?? DEFAULT_POLICY.maxPendingReservations,
      pickupWindowHours: val.pickupWindowHours ?? DEFAULT_POLICY.pickupWindowHours,
      currencyCode: val.currencyCode ?? DEFAULT_POLICY.currencyCode,
      dailyOverdueFineRate: val.dailyOverdueFineRate ?? DEFAULT_POLICY.dailyOverdueFineRate,
    };
  }

  /**
   * Updates circulation policy for a library branch.
   */
  async updateCirculationPolicy(
    organizationId: string,
    libraryId: string,
    staffUserId: string,
    dto: UpdateCirculationPolicyDto,
  ): Promise<CirculationPolicyDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    return tenantDs.transaction(async (manager) => {
      const current = await this.getCirculationPolicyWithManager(manager, libraryId);
      const merged: CirculationPolicyDto = {
        loanPeriodDays: dto.loanPeriodDays ?? current.loanPeriodDays,
        extensionIncrementDays: dto.extensionIncrementDays ?? current.extensionIncrementDays,
        maxExtensions: dto.maxExtensions ?? current.maxExtensions,
        maxActiveLoans: dto.maxActiveLoans ?? current.maxActiveLoans,
        maxPendingReservations: dto.maxPendingReservations ?? current.maxPendingReservations,
        pickupWindowHours: dto.pickupWindowHours ?? current.pickupWindowHours,
        currencyCode: dto.currencyCode ?? current.currencyCode,
        dailyOverdueFineRate: dto.dailyOverdueFineRate ?? current.dailyOverdueFineRate,
      };

      await manager.query(
        `INSERT INTO "library_settings" ("library_id", "setting_key", "value", "updated_by_user_id", "updated_at")
         VALUES ($1, 'circulation_policy', $2, $3, NOW())
         ON CONFLICT ("library_id", "setting_key")
         DO UPDATE SET "value" = EXCLUDED."value", "updated_by_user_id" = EXCLUDED."updated_by_user_id", "updated_at" = NOW()`,
        [libraryId, JSON.stringify(merged), staffUserId],
      );

      return merged;
    });
  }

  /**
   * Atomically checks out a physical copy.
   * Concurrency guarantee: Uses SELECT ... FOR UPDATE on book_copies so two requests
   * cannot check out the same physical item simultaneously.
   * If a linked reservation exists, it is atomically fulfilled.
   */
  async checkout(
    organizationId: string,
    libraryId: string,
    staffUserId: string,
    dto: CheckoutDto,
  ): Promise<LoanDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    return tenantDs.transaction(async (manager) => {
      const policy = await this.getCirculationPolicyWithManager(manager, libraryId);

      // 1. Check reader's active loan limit
      const activeCountRes = await manager.query(
        `SELECT COUNT(*) as count FROM "loans"
         WHERE "library_id" = $1 AND "reader_user_id" = $2 AND "status" IN ('ACTIVE', 'OVERDUE')`,
        [libraryId, dto.readerUserId],
      );
      const activeCount = parseInt(activeCountRes[0]?.count || '0', 10);
      if (activeCount >= policy.maxActiveLoans) {
        throw new BadRequestException(
          `Reader active loan limit (${policy.maxActiveLoans}) reached. Cannot checkout additional books.`,
        );
      }

      // 2. Lock Copy using SELECT ... FOR UPDATE
      const copyRows = await manager.query(
        `SELECT
          c.*,
          e.book_id as "bookId",
          e.edition_label as "editionLabel",
          e.format,
          b.title as "bookTitle",
          (
            SELECT a.name FROM "authors" a
            JOIN "book_authors" ba ON ba.author_id = a.author_id
            WHERE ba.book_id = b.book_id
            LIMIT 1
          ) as "authorName"
         FROM "book_copies" c
         JOIN "book_editions" e ON e.edition_id = c.edition_id
         JOIN "books" b ON b.book_id = e.book_id
         WHERE c.library_id = $1 AND c.barcode = $2
         FOR UPDATE`,
        [libraryId, dto.barcode.trim()],
      );

      if (copyRows.length === 0) {
        throw new NotFoundException(`Physical copy with barcode '${dto.barcode}' not found in this library`);
      }
      const copy = copyRows[0];

      // 3. Status checks on copy
      if (copy.status === CopyStatus.LOANED) {
        throw new ConflictException(`Copy '${dto.barcode}' is already checked out on loan`);
      }
      if ([CopyStatus.LOST, CopyStatus.DAMAGED, CopyStatus.WITHDRAWN].includes(copy.status)) {
        throw new BadRequestException(`Copy '${dto.barcode}' is currently ${copy.status} and cannot be checked out`);
      }

      // 4. Check holds & conflicting allocations
      let linkedReservationId: string | null = null;

      if (copy.status === CopyStatus.ON_HOLD) {
        // Find who holds this copy
        const holdRows = await manager.query(
          `SELECT * FROM "reservations"
           WHERE "assigned_copy_id" = $1 AND "status" IN ('ALLOCATED', 'READY_FOR_PICKUP')
           FOR UPDATE`,
          [copy.copy_id],
        );

        if (holdRows.length > 0) {
          const activeHold = holdRows[0];
          if (activeHold.reader_user_id !== dto.readerUserId) {
            throw new ConflictException(`Copy '${dto.barcode}' is reserved on hold for another reader`);
          }
          linkedReservationId = activeHold.reservation_id;
        }
      }

      // If dto specified reservationId, verify it
      if (dto.reservationId) {
        const resRows = await manager.query(
          `SELECT * FROM "reservations"
           WHERE "reservation_id" = $1 AND "library_id" = $2
           FOR UPDATE`,
          [dto.reservationId, libraryId],
        );
        if (resRows.length === 0) {
          throw new NotFoundException(`Reservation '${dto.reservationId}' not found`);
        }
        if (resRows[0].reader_user_id !== dto.readerUserId) {
          throw new BadRequestException('Reservation does not belong to the checkout reader');
        }
        linkedReservationId = dto.reservationId;
      } else if (!linkedReservationId) {
        // Check if reader has an active reservation for this edition
        const readerHolds = await manager.query(
          `SELECT "reservation_id" FROM "reservations"
           WHERE "library_id" = $1 AND "reader_user_id" = $2 AND "edition_id" = $3
             AND "status" IN ('ALLOCATED', 'READY_FOR_PICKUP', 'WAITLISTED')
           ORDER BY "created_at" ASC
           LIMIT 1
           FOR UPDATE`,
          [libraryId, dto.readerUserId, copy.edition_id],
        );
        if (readerHolds.length > 0) {
          linkedReservationId = readerHolds[0].reservation_id;
        }
      }

      // 5. Create Loan Record
      const dueAt = new Date(Date.now() + policy.loanPeriodDays * 24 * 60 * 60 * 1000);
      const policySnapshot = {
        loanPeriodDays: policy.loanPeriodDays,
        extensionIncrementDays: policy.extensionIncrementDays,
        maxExtensions: policy.maxExtensions,
        dailyOverdueFineRate: policy.dailyOverdueFineRate,
        currencyCode: policy.currencyCode,
      };

      const newLoan = this.extractRow(
        await manager.query(
          `INSERT INTO "loans" (
            "library_id", "copy_id", "reader_user_id", "reservation_id", "checked_out_by_user_id",
            "checked_out_at", "due_at", "status", "extension_count", "policy_snapshot"
          ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, 'ACTIVE', 0, $7)
          RETURNING *`,
          [
            libraryId,
            copy.copy_id,
            dto.readerUserId,
            linkedReservationId,
            staffUserId,
            dueAt.toISOString(),
            JSON.stringify(policySnapshot),
          ],
        ),
      );

      // 6. Update Copy status to LOANED
      await manager.query(
        `UPDATE "book_copies"
         SET "status" = 'LOANED', "current_location_id" = NULL, "updated_at" = NOW()
         WHERE "copy_id" = $1`,
        [copy.copy_id],
      );

      // 7. Fulfill linked reservation if present
      if (linkedReservationId) {
        await manager.query(
          `UPDATE "reservations"
           SET "status" = 'FULFILLED', "fulfilled_at" = NOW(), "assigned_copy_id" = $1
           WHERE "reservation_id" = $2`,
          [copy.copy_id, linkedReservationId],
        );
      }

      // 8. Notifications and Audit Logging
      if (this.notificationsService) {
        await this.notificationsService.createNotification(
          organizationId,
          {
            userId: dto.readerUserId,
            libraryId,
            eventType: 'LOAN_CHECKED_OUT',
            title: `Book Checked Out: ${copy.bookTitle}`,
            body: `You checked out "${copy.bookTitle}" (${copy.barcode}). Due on ${dueAt.toLocaleDateString()}.`,
            dedupeKey: `notif-loan-${newLoan.loan_id}`,
            payload: { loanId: newLoan.loan_id, barcode: copy.barcode, dueAt: dueAt.toISOString() },
          },
          manager,
        );
      }

      if (this.auditService) {
        await this.auditService.log(
          organizationId,
          {
            libraryId,
            actorUserId: staffUserId,
            action: 'CHECKOUT_BOOK',
            entityType: 'LOAN',
            entityId: newLoan.loan_id,
            newValue: { readerUserId: dto.readerUserId, barcode: copy.barcode, dueAt: dueAt.toISOString() },
          },
          manager,
        );
      }

      this.logger.log(
        `Loan created: copy ${dto.barcode} checked out to reader ${dto.readerUserId}. Due: ${dueAt.toISOString()}`,
      );

      return {
        loanId: newLoan.loan_id,
        libraryId,
        copyId: copy.copy_id,
        readerUserId: dto.readerUserId,
        reservationId: linkedReservationId,
        barcode: copy.barcode,
        bookTitle: copy.bookTitle,
        authorName: copy.authorName,
        editionLabel: copy.editionLabel,
        format: copy.format,
        checkedOutAt: new Date(newLoan.checked_out_at).toISOString(),
        dueAt: new Date(newLoan.due_at).toISOString(),
        returnedAt: null,
        status: LoanStatus.ACTIVE,
        extensionCount: 0,
        isOverdue: false,
        policySnapshot,
      };
    });
  }

  /**
   * Atomically returns a loaned copy.
   * Closes the loan, updates condition, and checks if next FIFO reservation is waiting.
   * If a waitlist reservation exists, allocates copy to it (ON_HOLD).
   * Otherwise releases copy to AVAILABLE.
   */
  async returnCopy(
    organizationId: string,
    libraryId: string,
    staffUserId: string,
    dto: ReturnDto,
  ): Promise<{ loan?: LoanDto; copyStatus: CopyStatus; nextReservation?: ReservationDto }> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    return tenantDs.transaction(async (manager) => {
      // 1. Lock Copy FOR UPDATE
      const copyRows = await manager.query(
        `SELECT
          c.*,
          e.book_id as "bookId",
          e.edition_label as "editionLabel",
          e.format,
          b.title as "bookTitle",
          (
            SELECT a.name FROM "authors" a
            JOIN "book_authors" ba ON ba.author_id = a.author_id
            WHERE ba.book_id = b.book_id
            LIMIT 1
          ) as "authorName"
         FROM "book_copies" c
         JOIN "book_editions" e ON e.edition_id = c.edition_id
         JOIN "books" b ON b.book_id = e.book_id
         WHERE c.library_id = $1 AND c.barcode = $2
         FOR UPDATE`,
        [libraryId, dto.barcode.trim()],
      );

      if (copyRows.length === 0) {
        throw new NotFoundException(`Physical copy with barcode '${dto.barcode}' not found in this library`);
      }
      const copy = copyRows[0];

      // 2. Lock active loan FOR UPDATE
      const loanRows = await manager.query(
        `SELECT * FROM "loans"
         WHERE "library_id" = $1 AND "copy_id" = $2 AND "status" IN ('ACTIVE', 'OVERDUE')
         FOR UPDATE`,
        [libraryId, copy.copy_id],
      );

      let closedLoan: LoanDto | undefined;

      if (loanRows.length > 0) {
        const activeLoan = loanRows[0];
        const updatedLoan = this.extractRow(
          await manager.query(
            `UPDATE "loans"
             SET "status" = 'RETURNED', "returned_at" = NOW()
             WHERE "loan_id" = $1
             RETURNING *`,
            [activeLoan.loan_id],
          ),
        );

        closedLoan = {
          loanId: updatedLoan.loan_id,
          libraryId,
          copyId: copy.copy_id,
          readerUserId: updatedLoan.reader_user_id,
          reservationId: updatedLoan.reservation_id,
          barcode: copy.barcode,
          bookTitle: copy.bookTitle,
          authorName: copy.authorName,
          editionLabel: copy.editionLabel,
          format: copy.format,
          checkedOutAt: new Date(updatedLoan.checked_out_at).toISOString(),
          dueAt: new Date(updatedLoan.due_at).toISOString(),
          returnedAt: new Date(updatedLoan.returned_at).toISOString(),
          status: LoanStatus.RETURNED,
          extensionCount: updatedLoan.extension_count,
          isOverdue: false,
        };
      }

      // 3. Update Condition if specified
      if (dto.condition) {
        await manager.query(
          `UPDATE "book_copies" SET "condition" = $1, "updated_at" = NOW() WHERE "copy_id" = $2`,
          [dto.condition, copy.copy_id],
        );
      }

      // 4. Check for next FIFO waitlisted reservation
      const waitlistRows = await manager.query(
        `SELECT * FROM "reservations"
         WHERE "library_id" = $1 AND "edition_id" = $2 AND "status" = 'WAITLISTED'
         ORDER BY "created_at" ASC
         LIMIT 1
         FOR UPDATE`,
        [libraryId, copy.edition_id],
      );

      let nextReservation: ReservationDto | undefined;
      let finalCopyStatus: CopyStatus = CopyStatus.AVAILABLE;

      if (waitlistRows.length > 0) {
        const nextRes = waitlistRows[0];
        // Allocate copy to next reservation (pickup countdown does NOT start until physically ready)
        const allocatedRes = this.extractRow(
          await manager.query(
            `UPDATE "reservations"
             SET "status" = 'ALLOCATED', "assigned_copy_id" = $1, "allocated_at" = NOW()
             WHERE "reservation_id" = $2
             RETURNING *`,
            [copy.copy_id, nextRes.reservation_id],
          ),
        );

        // Put copy on hold at its home location
        await manager.query(
          `UPDATE "book_copies"
           SET "status" = 'ON_HOLD', "current_location_id" = "home_location_id", "updated_at" = NOW()
           WHERE "copy_id" = $1`,
          [copy.copy_id],
        );
        finalCopyStatus = CopyStatus.ON_HOLD;

        nextReservation = {
          reservationId: allocatedRes.reservation_id,
          libraryId,
          readerUserId: allocatedRes.reader_user_id,
          editionId: allocatedRes.edition_id,
          bookTitle: copy.bookTitle,
          authorName: copy.authorName,
          editionLabel: copy.editionLabel,
          assignedCopyId: copy.copy_id,
          assignedBarcode: copy.barcode,
          status: ReservationStatus.ALLOCATED,
          createdAt: new Date(allocatedRes.created_at).toISOString(),
          allocatedAt: new Date(allocatedRes.allocated_at).toISOString(),
          readyAt: null,
          pickupDeadlineAt: null,
          fulfilledAt: null,
          cancelledAt: null,
        };
      } else {
        // No waitlist: return copy to available
        await manager.query(
          `UPDATE "book_copies"
           SET "status" = 'AVAILABLE', "current_location_id" = "home_location_id", "updated_at" = NOW()
           WHERE "copy_id" = $1`,
          [copy.copy_id],
        );
        finalCopyStatus = CopyStatus.AVAILABLE;
      }

      this.logger.log(
        `Copy ${dto.barcode} returned. Final status: ${finalCopyStatus}. Next hold: ${nextReservation ? nextReservation.reservationId : 'none'}`,
      );

      // Notifications and Audit Logging
      if (closedLoan) {
        if (this.notificationsService) {
          await this.notificationsService.createNotification(
            organizationId,
            {
              userId: closedLoan.readerUserId,
              libraryId,
              eventType: 'LOAN_RETURNED',
              title: `Book Returned: ${closedLoan.bookTitle}`,
              body: `You returned "${closedLoan.bookTitle}" (${closedLoan.barcode}). Thank you!`,
              dedupeKey: `notif-return-${closedLoan.loanId}`,
              payload: { loanId: closedLoan.loanId, barcode: closedLoan.barcode, returnedAt: closedLoan.returnedAt },
            },
            manager,
          );
        }

        if (this.auditService) {
          await this.auditService.log(
            organizationId,
            {
              libraryId,
              actorUserId: staffUserId,
              action: 'RETURN_BOOK',
              entityType: 'LOAN',
              entityId: closedLoan.loanId,
              newValue: { barcode: copy.barcode, condition: dto.condition, nextStatus: finalCopyStatus },
            },
            manager,
          );
        }
      }

      return {
        loan: closedLoan,
        copyStatus: finalCopyStatus,
        nextReservation,
      };
    });
  }

  /**
   * Reader or staff reserves an edition.
   * If an available copy already exists, immediately allocates it (ALLOCATED / ON_HOLD).
   * Otherwise queues the reader in the FIFO waitlist (WAITLISTED).
   */
  async createReservation(
    organizationId: string,
    libraryId: string,
    actorUserId: string,
    dto: CreateReservationDto,
  ): Promise<ReservationDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    return tenantDs.transaction(async (manager) => {
      const targetUserId = dto.readerUserId || actorUserId;
      const policy = await this.getCirculationPolicyWithManager(manager, libraryId);

      // 1. Check pending reservations limit
      const pendingCountRes = await manager.query(
        `SELECT COUNT(*) as count FROM "reservations"
         WHERE "library_id" = $1 AND "reader_user_id" = $2 AND "status" IN ('WAITLISTED', 'ALLOCATED', 'READY_FOR_PICKUP')`,
        [libraryId, targetUserId],
      );
      const pendingCount = parseInt(pendingCountRes[0]?.count || '0', 10);
      if (pendingCount >= policy.maxPendingReservations) {
        throw new BadRequestException(
          `Reader pending reservation limit (${policy.maxPendingReservations}) reached`,
        );
      }

      // 2. Check for duplicate active hold on this edition
      const dupRes = await manager.query(
        `SELECT "reservation_id" FROM "reservations"
         WHERE "library_id" = $1 AND "reader_user_id" = $2 AND "edition_id" = $3
           AND "status" IN ('WAITLISTED', 'ALLOCATED', 'READY_FOR_PICKUP')`,
        [libraryId, targetUserId, dto.editionId],
      );
      if (dupRes.length > 0) {
        throw new ConflictException('Reader already has an active hold on this edition');
      }

      // 3. Check if reader currently has this book on loan
      const activeLoanCheck = await manager.query(
        `SELECT l."loan_id" FROM "loans" l
         JOIN "book_copies" c ON c."copy_id" = l."copy_id"
         WHERE l."library_id" = $1 AND l."reader_user_id" = $2 AND c."edition_id" = $3
           AND l."status" IN ('ACTIVE', 'OVERDUE')`,
        [libraryId, targetUserId, dto.editionId],
      );
      if (activeLoanCheck.length > 0) {
        throw new BadRequestException('Reader currently has a physical copy of this edition checked out on loan');
      }

      // 4. Fetch Edition & Book title
      const editionRows = await manager.query(
        `SELECT e.*, b.title as "bookTitle",
          (
            SELECT a.name FROM "authors" a
            JOIN "book_authors" ba ON ba.author_id = a.author_id
            WHERE ba.book_id = b.book_id
            LIMIT 1
          ) as "authorName"
         FROM "book_editions" e
         JOIN "books" b ON b.book_id = e.book_id
         WHERE e.edition_id = $1`,
        [dto.editionId],
      );
      if (editionRows.length === 0) {
        throw new NotFoundException(`Edition '${dto.editionId}' not found`);
      }
      const edition = editionRows[0];

      // 5. Check if an available copy is sitting on shelf right now
      const availCopyRows = await manager.query(
        `SELECT * FROM "book_copies"
         WHERE "library_id" = $1 AND "edition_id" = $2 AND "status" = 'AVAILABLE'
         ORDER BY "created_at" ASC
         LIMIT 1
         FOR UPDATE`,
        [libraryId, dto.editionId],
      );

      let initialStatus = ReservationStatus.WAITLISTED;
      let assignedCopyId: string | null = null;
      let assignedBarcode: string | null = null;

      if (availCopyRows.length > 0) {
        const availCopy = availCopyRows[0];
        initialStatus = ReservationStatus.ALLOCATED;
        assignedCopyId = availCopy.copy_id;
        assignedBarcode = availCopy.barcode;

        // Mark copy as ON_HOLD
        await manager.query(
          `UPDATE "book_copies"
           SET "status" = 'ON_HOLD', "updated_at" = NOW()
           WHERE "copy_id" = $1`,
          [availCopy.copy_id],
        );
      }

      // 6. Create Reservation
      const res = this.extractRow(
        await manager.query(
          `INSERT INTO "reservations" (
            "library_id", "reader_user_id", "edition_id", "assigned_copy_id", "status",
            "created_at", "allocated_at"
          ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)
          RETURNING *`,
          [
            libraryId,
            targetUserId,
            dto.editionId,
            assignedCopyId,
            initialStatus,
            assignedCopyId ? new Date().toISOString() : null,
          ],
        ),
      );

      // Compute queue position
      let queuePos = 1;
      if (initialStatus === ReservationStatus.WAITLISTED) {
        const queueRes = await manager.query(
          `SELECT COUNT(*) as count FROM "reservations"
           WHERE "library_id" = $1 AND "edition_id" = $2 AND "status" = 'WAITLISTED'
             AND "created_at" <= (SELECT "created_at" FROM "reservations" WHERE "reservation_id" = $3)`,
          [libraryId, dto.editionId, res.reservation_id],
        );
        queuePos = Math.max(1, parseInt(queueRes[0]?.count || '1', 10));
      }

      return {
        reservationId: res.reservation_id,
        libraryId,
        readerUserId: targetUserId,
        editionId: dto.editionId,
        bookTitle: edition.bookTitle,
        authorName: edition.authorName,
        editionLabel: edition.edition_label,
        assignedCopyId,
        assignedBarcode,
        status: initialStatus,
        queuePosition: queuePos,
        createdAt: new Date(res.created_at).toISOString(),
        allocatedAt: res.allocated_at ? new Date(res.allocated_at).toISOString() : null,
        readyAt: null,
        pickupDeadlineAt: null,
        fulfilledAt: null,
        cancelledAt: null,
      };
    });
  }

  /**
   * Staff confirms that an allocated physical copy is physically placed and ready for reader pickup.
   * Specification rule: The 72-hour default pickup countdown starts ONLY after
   * the copy is physically ready and its pickup location is confirmed.
   */
  async markReadyForPickup(
    organizationId: string,
    libraryId: string,
    staffUserId: string,
    reservationId: string,
    dto: ReadyForPickupDto,
  ): Promise<ReservationDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    return tenantDs.transaction(async (manager) => {
      const policy = await this.getCirculationPolicyWithManager(manager, libraryId);

      // 1. Lock Reservation FOR UPDATE
      const resRows = await manager.query(
        `SELECT
          r.*,
          e.edition_label as "editionLabel",
          b.title as "bookTitle",
          c.barcode as "assignedBarcode",
          c.home_location_id,
          (
            SELECT a.name FROM "authors" a
            JOIN "book_authors" ba ON ba.author_id = a.author_id
            WHERE ba.book_id = b.book_id
            LIMIT 1
          ) as "authorName"
         FROM "reservations" r
         JOIN "book_editions" e ON e.edition_id = r.edition_id
         JOIN "books" b ON b.book_id = e.book_id
         LEFT JOIN "book_copies" c ON c.copy_id = r.assigned_copy_id
         WHERE r.library_id = $1 AND r.reservation_id = $2
         FOR UPDATE OF r`,
        [libraryId, reservationId],
      );

      if (resRows.length === 0) {
        throw new NotFoundException(`Reservation '${reservationId}' not found`);
      }
      const reservation = resRows[0];

      if (reservation.status !== ReservationStatus.ALLOCATED) {
        throw new BadRequestException(
          `Reservation status must be ALLOCATED to confirm pickup readiness (current status: ${reservation.status})`,
        );
      }
      if (!reservation.assigned_copy_id) {
        throw new BadRequestException('No physical copy has been allocated to this reservation');
      }

      // 2. Lock Copy FOR UPDATE and update physical pickup location if provided
      await manager.query(
        `SELECT copy_id FROM "book_copies" WHERE copy_id = $1 FOR UPDATE`,
        [reservation.assigned_copy_id],
      );

      const pickupLocationId = dto.pickupLocationId || reservation.home_location_id;
      if (pickupLocationId) {
        await manager.query(
          `UPDATE "book_copies"
           SET "current_location_id" = $1, "updated_at" = NOW()
           WHERE "copy_id" = $2`,
          [pickupLocationId, reservation.assigned_copy_id],
        );
      }

      // 3. Set Ready and start pickup countdown (default 72 hours from confirmation)
      const pickupDeadline = new Date(Date.now() + policy.pickupWindowHours * 60 * 60 * 1000);

      const updated = this.extractRow(
        await manager.query(
          `UPDATE "reservations"
           SET "status" = 'READY_FOR_PICKUP',
               "ready_at" = NOW(),
               "pickup_deadline_at" = $1
           WHERE "reservation_id" = $2
           RETURNING *`,
          [pickupDeadline.toISOString(), reservationId],
        ),
      );

      this.logger.log(
        `Reservation ${reservationId} marked READY_FOR_PICKUP. Deadline: ${pickupDeadline.toISOString()}`,
      );

      if (this.notificationsService) {
        await this.notificationsService.createNotification(
          organizationId,
          {
            userId: updated.reader_user_id,
            libraryId,
            eventType: 'RESERVATION_READY_FOR_PICKUP',
            title: `Ready for Pickup: ${reservation.bookTitle}`,
            body: `Your reserved copy of "${reservation.bookTitle}" (${reservation.assignedBarcode || ''}) is ready for pickup. Please collect it within ${policy.pickupWindowHours} hours (by ${pickupDeadline.toLocaleDateString()}).`,
            dedupeKey: `notif-res-ready-${reservationId}`,
            payload: {
              reservationId,
              pickupDeadline: pickupDeadline.toISOString(),
              pickupLocationId,
            },
          },
          manager,
        );
      }

      if (this.auditService) {
        await this.auditService.log(
          organizationId,
          {
            libraryId,
            actorUserId: staffUserId,
            action: 'MARK_READY_FOR_PICKUP',
            entityType: 'RESERVATION',
            entityId: reservationId,
            newValue: {
              pickupDeadline: pickupDeadline.toISOString(),
              pickupLocationId,
            },
          },
          manager,
        );
      }

      return {
        reservationId: updated.reservation_id,
        libraryId,
        readerUserId: updated.reader_user_id,
        editionId: updated.edition_id,
        bookTitle: reservation.bookTitle,
        authorName: reservation.authorName,
        editionLabel: reservation.editionLabel,
        assignedCopyId: reservation.assigned_copy_id,
        assignedBarcode: reservation.assignedBarcode,
        pickupLocationCode: dto.pickupLocationId,
        status: ReservationStatus.READY_FOR_PICKUP,
        createdAt: new Date(updated.created_at).toISOString(),
        allocatedAt: updated.allocated_at ? new Date(updated.allocated_at).toISOString() : null,
        readyAt: new Date(updated.ready_at).toISOString(),
        pickupDeadlineAt: new Date(updated.pickup_deadline_at).toISOString(),
        fulfilledAt: null,
        cancelledAt: null,
      };
    });
  }

  /**
   * Idempotent Expiry & Reassignment Engine:
   * Finds reservations whose 72-hour pickup deadline has expired.
   * Safely marks expired and reassigns copy to the next FIFO waitlisted reader.
   * If no waitlist exists, returns copy to AVAILABLE.
   */
  async processExpiries(
    organizationId: string,
    libraryId: string,
  ): Promise<{ expiredCount: number; reassignedCount: number }> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    return tenantDs.transaction(async (manager) => {
      // 1. Lock all expired reservations
      const expiredRows = await manager.query(
        `SELECT * FROM "reservations"
         WHERE "library_id" = $1 AND "status" = 'READY_FOR_PICKUP' AND "pickup_deadline_at" < NOW()
         FOR UPDATE`,
        [libraryId],
      );

      let reassignedCount = 0;

      for (const res of expiredRows) {
        // Mark expired
        await manager.query(
          `UPDATE "reservations"
           SET "status" = 'EXPIRED'
           WHERE "reservation_id" = $1`,
          [res.reservation_id],
        );

        if (this.notificationsService) {
          await this.notificationsService.createNotification(
            organizationId,
            {
              userId: res.reader_user_id,
              libraryId,
              eventType: 'RESERVATION_EXPIRED',
              title: `Hold Expired: Reservation #${res.reservation_id}`,
              body: `Your hold reservation has expired as it was not collected within the pickup window.`,
              dedupeKey: `notif-res-expired-${res.reservation_id}`,
              payload: { reservationId: res.reservation_id, expiredAt: new Date().toISOString() },
            },
            manager,
          );
        }

        if (this.auditService) {
          await this.auditService.log(
            organizationId,
            {
              libraryId,
              actorUserId: 'SYSTEM',
              action: 'EXPIRE_RESERVATION',
              entityType: 'RESERVATION',
              entityId: res.reservation_id,
              newValue: { expiredAt: new Date().toISOString() },
            },
            manager,
          );
        }

        if (!res.assigned_copy_id) continue;

        // Lock copy FOR UPDATE
        const copyRows = await manager.query(
          `SELECT * FROM "book_copies" WHERE "copy_id" = $1 FOR UPDATE`,
          [res.assigned_copy_id],
        );
        if (copyRows.length === 0) continue;
        const copy = copyRows[0];

        // Check next waitlist reservation
        const waitlistRows = await manager.query(
          `SELECT * FROM "reservations"
           WHERE "library_id" = $1 AND "edition_id" = $2 AND "status" = 'WAITLISTED'
           ORDER BY "created_at" ASC
           LIMIT 1
           FOR UPDATE`,
          [libraryId, res.edition_id],
        );

        if (waitlistRows.length > 0) {
          const nextWaitlist = waitlistRows[0];
          await manager.query(
            `UPDATE "reservations"
             SET "status" = 'ALLOCATED', "assigned_copy_id" = $1, "allocated_at" = NOW()
             WHERE "reservation_id" = $2`,
            [copy.copy_id, nextWaitlist.reservation_id],
          );
          // Copy remains ON_HOLD
          await manager.query(
            `UPDATE "book_copies"
             SET "status" = 'ON_HOLD', "current_location_id" = "home_location_id", "updated_at" = NOW()
             WHERE "copy_id" = $1`,
            [copy.copy_id],
          );
          reassignedCount++;
        } else {
          // Release copy back to AVAILABLE
          await manager.query(
            `UPDATE "book_copies"
             SET "status" = 'AVAILABLE', "current_location_id" = "home_location_id", "updated_at" = NOW()
             WHERE "copy_id" = $1`,
            [copy.copy_id],
          );
        }
      }

      this.logger.log(
        `Expiry sweep for library ${libraryId}: ${expiredRows.length} expired, ${reassignedCount} reassigned.`,
      );

      return {
        expiredCount: expiredRows.length,
        reassignedCount,
      };
    });
  }

  /**
   * Extends an active loan according to library rules:
   * Default increment 7 days, max 2 extensions.
   * Prohibits extension if loan is overdue or if another reader has reserved this title on hold.
   */
  async extendLoan(
    organizationId: string,
    libraryId: string,
    actorUserId: string,
    loanId: string,
  ): Promise<LoanDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    return tenantDs.transaction(async (manager) => {
      const policy = await this.getCirculationPolicyWithManager(manager, libraryId);

      // 1. Lock Loan FOR UPDATE
      const loanRows = await manager.query(
        `SELECT
          l.*,
          c.barcode,
          c.edition_id as "editionId",
          e.edition_label as "editionLabel",
          e.format,
          b.title as "bookTitle",
          (
            SELECT a.name FROM "authors" a
            JOIN "book_authors" ba ON ba.author_id = a.author_id
            WHERE ba.book_id = b.book_id
            LIMIT 1
          ) as "authorName"
         FROM "loans" l
         JOIN "book_copies" c ON c.copy_id = l.copy_id
         JOIN "book_editions" e ON e.edition_id = c.edition_id
         JOIN "books" b ON b.book_id = e.book_id
         WHERE l.library_id = $1 AND l.loan_id = $2
         FOR UPDATE`,
        [libraryId, loanId],
      );

      if (loanRows.length === 0) {
        throw new NotFoundException(`Loan '${loanId}' not found`);
      }
      const loan = loanRows[0];

      if (loan.status !== LoanStatus.ACTIVE) {
        throw new BadRequestException(`Cannot extend loan: status is ${loan.status}`);
      }

      // Check Overdue: Prohibit extending overdue loan
      if (new Date(loan.due_at).getTime() < Date.now()) {
        throw new BadRequestException(
          'Cannot extend an overdue loan. Please return the book or settle overdue fees at the circulation desk.',
        );
      }

      // Check Max Extensions
      if (loan.extension_count >= policy.maxExtensions) {
        throw new BadRequestException(
          `Maximum allowed extensions (${policy.maxExtensions}) reached for this loan`,
        );
      }

      // Check if title has waitlisted reservations from other readers
      const waitlistRes = await manager.query(
        `SELECT COUNT(*) as count FROM "reservations"
         WHERE "library_id" = $1 AND "edition_id" = $2 AND "status" = 'WAITLISTED'`,
        [libraryId, loan.editionId],
      );
      if (parseInt(waitlistRes[0]?.count || '0', 10) > 0) {
        throw new ConflictException(
          'Cannot extend loan: another reader is waiting in the reservation queue for this title',
        );
      }

      // Compute new due date
      const currentDue = new Date(loan.due_at).getTime();
      const newDueAt = new Date(currentDue + policy.extensionIncrementDays * 24 * 60 * 60 * 1000);

      const updatedLoan = this.extractRow(
        await manager.query(
          `UPDATE "loans"
           SET "extension_count" = "extension_count" + 1,
               "due_at" = $1
           WHERE "loan_id" = $2
           RETURNING *`,
          [newDueAt.toISOString(), loanId],
        ),
      );

      this.logger.log(
        `Loan ${loanId} extended (+${policy.extensionIncrementDays}d). New due date: ${newDueAt.toISOString()}`,
      );

      if (this.notificationsService) {
        await this.notificationsService.createNotification(
          organizationId,
          {
            userId: updatedLoan.reader_user_id,
            libraryId,
            eventType: 'LOAN_EXTENDED',
            title: `Loan Extended: ${loan.bookTitle}`,
            body: `Your loan for "${loan.bookTitle}" has been extended. New due date is ${newDueAt.toLocaleDateString()}.`,
            dedupeKey: `notif-loan-extend-${loan.loan_id}-${updatedLoan.extension_count}`,
            payload: {
              loanId: loan.loan_id,
              newDueAt: newDueAt.toISOString(),
              extensionCount: updatedLoan.extension_count,
            },
          },
          manager,
        );
      }

      if (this.auditService) {
        await this.auditService.log(
          organizationId,
          {
            libraryId,
            actorUserId,
            action: 'EXTEND_LOAN',
            entityType: 'LOAN',
            entityId: loan.loan_id,
            newValue: {
              newDueAt: newDueAt.toISOString(),
              extensionCount: updatedLoan.extension_count,
            },
          },
          manager,
        );
      }

      return {
        loanId: updatedLoan.loan_id,
        libraryId,
        copyId: loan.copy_id,
        readerUserId: updatedLoan.reader_user_id,
        reservationId: updatedLoan.reservation_id,
        barcode: loan.barcode,
        bookTitle: loan.bookTitle,
        authorName: loan.authorName,
        editionLabel: loan.editionLabel,
        format: loan.format,
        checkedOutAt: new Date(updatedLoan.checked_out_at).toISOString(),
        dueAt: new Date(updatedLoan.due_at).toISOString(),
        returnedAt: null,
        status: LoanStatus.ACTIVE,
        extensionCount: updatedLoan.extension_count,
        isOverdue: false,
      };
    });
  }

  /**
   * Cancels an active reservation and safely releases any assigned copy.
   */
  async cancelReservation(
    organizationId: string,
    libraryId: string,
    actorUserId: string,
    reservationId: string,
  ): Promise<ReservationDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    return tenantDs.transaction(async (manager) => {
      const resRows = await manager.query(
        `SELECT
          r.*,
          e.edition_label as "editionLabel",
          b.title as "bookTitle",
          c.barcode as "assignedBarcode",
          (
            SELECT a.name FROM "authors" a
            JOIN "book_authors" ba ON ba.author_id = a.author_id
            WHERE ba.book_id = b.book_id
            LIMIT 1
          ) as "authorName"
         FROM "reservations" r
         JOIN "book_editions" e ON e.edition_id = r.edition_id
         JOIN "books" b ON b.book_id = e.book_id
         LEFT JOIN "book_copies" c ON c.copy_id = r.assigned_copy_id
         WHERE r.library_id = $1 AND r.reservation_id = $2
         FOR UPDATE OF r`,
        [libraryId, reservationId],
      );

      if (resRows.length === 0) {
        throw new NotFoundException(`Reservation '${reservationId}' not found`);
      }
      const reservation = resRows[0];

      if ([ReservationStatus.FULFILLED, ReservationStatus.EXPIRED, ReservationStatus.CANCELLED].includes(reservation.status)) {
        throw new BadRequestException(`Cannot cancel reservation in ${reservation.status} state`);
      }

      // Mark cancelled
      const updated = this.extractRow(
        await manager.query(
          `UPDATE "reservations"
           SET "status" = 'CANCELLED', "cancelled_at" = NOW()
           WHERE "reservation_id" = $1
           RETURNING *`,
          [reservationId],
        ),
      );

      // If a copy was assigned, reassign or release
      if (reservation.assigned_copy_id) {
        const copyRows = await manager.query(
          `SELECT * FROM "book_copies" WHERE "copy_id" = $1 FOR UPDATE`,
          [reservation.assigned_copy_id],
        );
        if (copyRows.length > 0) {
          const copy = copyRows[0];
          // Check next in queue
          const waitlistRows = await manager.query(
            `SELECT * FROM "reservations"
             WHERE "library_id" = $1 AND "edition_id" = $2 AND "status" = 'WAITLISTED'
             ORDER BY "created_at" ASC
             LIMIT 1
             FOR UPDATE`,
            [libraryId, reservation.edition_id],
          );

          if (waitlistRows.length > 0) {
            await manager.query(
              `UPDATE "reservations"
               SET "status" = 'ALLOCATED', "assigned_copy_id" = $1, "allocated_at" = NOW()
               WHERE "reservation_id" = $2`,
              [copy.copy_id, waitlistRows[0].reservation_id],
            );
          } else {
            await manager.query(
              `UPDATE "book_copies"
               SET "status" = 'AVAILABLE', "current_location_id" = "home_location_id", "updated_at" = NOW()
               WHERE "copy_id" = $1`,
              [copy.copy_id],
            );
          }
        }
      }

      return {
        reservationId: updated.reservation_id,
        libraryId,
        readerUserId: updated.reader_user_id,
        editionId: updated.edition_id,
        bookTitle: reservation.bookTitle,
        authorName: reservation.authorName,
        editionLabel: reservation.editionLabel,
        assignedCopyId: null,
        assignedBarcode: null,
        status: ReservationStatus.CANCELLED,
        createdAt: new Date(updated.created_at).toISOString(),
        allocatedAt: updated.allocated_at ? new Date(updated.allocated_at).toISOString() : null,
        readyAt: updated.ready_at ? new Date(updated.ready_at).toISOString() : null,
        pickupDeadlineAt: updated.pickup_deadline_at ? new Date(updated.pickup_deadline_at).toISOString() : null,
        fulfilledAt: null,
        cancelledAt: new Date(updated.cancelled_at).toISOString(),
      };
    });
  }

  /**
   * Queries loans for the circulation desk or reader dashboard.
   */
  async getLoans(
    organizationId: string,
    libraryId: string,
    query: LoansQueryDto,
  ): Promise<{ items: LoanDto[]; total: number }> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const { readerUserId, status, search, limit = 50, offset = 0 } = query;
    const where = [`l.library_id = $1`];
    const params: any[] = [libraryId];
    let pIdx = 2;

    if (readerUserId) {
      params.push(readerUserId);
      where.push(`l.reader_user_id = $${pIdx}`);
      pIdx++;
    }

    if (status) {
      params.push(status);
      where.push(`l.status = $${pIdx}`);
      pIdx++;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      where.push(`(
        LOWER(c.barcode) LIKE $${pIdx} OR
        LOWER(b.title) LIKE $${pIdx}
      )`);
      pIdx++;
    }

    const baseSql = `
      FROM "loans" l
      JOIN "book_copies" c ON c.copy_id = l.copy_id
      JOIN "book_editions" e ON e.edition_id = c.edition_id
      JOIN "books" b ON b.book_id = e.book_id
      WHERE ${where.join(' AND ')}
    `;

    const countRes = await tenantDs.query(`SELECT COUNT(*) as total ${baseSql}`, params);
    const total = parseInt(countRes[0]?.total || '0', 10);

    const selectSql = `
      SELECT
        l.*,
        c.barcode,
        e.edition_label as "editionLabel",
        e.format,
        b.title as "bookTitle",
        (
          SELECT a.name FROM "authors" a
          JOIN "book_authors" ba ON ba.author_id = a.author_id
          WHERE ba.book_id = b.book_id
          LIMIT 1
        ) as "authorName"
      ${baseSql}
      ORDER BY (l.status = 'ACTIVE') DESC, l.due_at ASC
      LIMIT $${pIdx} OFFSET $${pIdx + 1}
    `;

    params.push(limit, offset);
    const rows = await tenantDs.query(selectSql, params);

    const now = Date.now();
    const items: LoanDto[] = rows.map((r: any) => ({
      loanId: r.loan_id,
      libraryId: r.library_id,
      copyId: r.copy_id,
      readerUserId: r.reader_user_id,
      reservationId: r.reservation_id,
      barcode: r.barcode,
      bookTitle: r.bookTitle,
      authorName: r.authorName,
      editionLabel: r.editionLabel,
      format: r.format,
      checkedOutAt: new Date(r.checked_out_at).toISOString(),
      dueAt: new Date(r.due_at).toISOString(),
      returnedAt: r.returned_at ? new Date(r.returned_at).toISOString() : null,
      status: r.status as LoanStatus,
      extensionCount: r.extension_count,
      isOverdue: r.status === LoanStatus.ACTIVE && new Date(r.due_at).getTime() < now,
    }));

    return { items, total };
  }

  /**
   * Queries reservations for the circulation desk or reader dashboard.
   */
  async getReservations(
    organizationId: string,
    libraryId: string,
    query: ReservationsQueryDto,
  ): Promise<{ items: ReservationDto[]; total: number }> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const { readerUserId, editionId, status, limit = 50, offset = 0 } = query;
    const where = [`r.library_id = $1`];
    const params: any[] = [libraryId];
    let pIdx = 2;

    if (readerUserId) {
      params.push(readerUserId);
      where.push(`r.reader_user_id = $${pIdx}`);
      pIdx++;
    }

    if (editionId) {
      params.push(editionId);
      where.push(`r.edition_id = $${pIdx}`);
      pIdx++;
    }

    if (status) {
      params.push(status);
      where.push(`r.status = $${pIdx}`);
      pIdx++;
    }

    const baseSql = `
      FROM "reservations" r
      JOIN "book_editions" e ON e.edition_id = r.edition_id
      JOIN "books" b ON b.book_id = e.book_id
      LEFT JOIN "book_copies" c ON c.copy_id = r.assigned_copy_id
      WHERE ${where.join(' AND ')}
    `;

    const countRes = await tenantDs.query(`SELECT COUNT(*) as total ${baseSql}`, params);
    const total = parseInt(countRes[0]?.total || '0', 10);

    const selectSql = `
      SELECT
        r.*,
        e.edition_label as "editionLabel",
        b.title as "bookTitle",
        c.barcode as "assignedBarcode",
        (
          SELECT a.name FROM "authors" a
          JOIN "book_authors" ba ON ba.author_id = a.author_id
          WHERE ba.book_id = b.book_id
          LIMIT 1
        ) as "authorName"
      ${baseSql}
      ORDER BY (r.status IN ('READY_FOR_PICKUP', 'ALLOCATED', 'WAITLISTED')) DESC, r.created_at ASC
      LIMIT $${pIdx} OFFSET $${pIdx + 1}
    `;

    params.push(limit, offset);
    const rows = await tenantDs.query(selectSql, params);

    const items: ReservationDto[] = rows.map((r: any) => ({
      reservationId: r.reservation_id,
      libraryId: r.library_id,
      readerUserId: r.reader_user_id,
      editionId: r.edition_id,
      bookTitle: r.bookTitle,
      authorName: r.authorName,
      editionLabel: r.editionLabel,
      assignedCopyId: r.assigned_copy_id,
      assignedBarcode: r.assignedBarcode,
      status: r.status as ReservationStatus,
      createdAt: new Date(r.created_at).toISOString(),
      allocatedAt: r.allocated_at ? new Date(r.allocated_at).toISOString() : null,
      readyAt: r.ready_at ? new Date(r.ready_at).toISOString() : null,
      pickupDeadlineAt: r.pickup_deadline_at ? new Date(r.pickup_deadline_at).toISOString() : null,
      fulfilledAt: r.fulfilled_at ? new Date(r.fulfilled_at).toISOString() : null,
      cancelledAt: r.cancelled_at ? new Date(r.cancelled_at).toISOString() : null,
    }));

    return { items, total };
  }

  /**
   * Retrieves high-level circulation desk KPI statistics.
   */
  async getCirculationStats(
    organizationId: string,
    libraryId: string,
  ): Promise<CirculationDeskStatsResponse> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const loansRes = await tenantDs.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as "activeLoansCount",
        COUNT(*) FILTER (WHERE status = 'ACTIVE' AND due_at < NOW()) as "overdueLoansCount"
       FROM "loans"
       WHERE library_id = $1`,
      [libraryId],
    );

    const resRes = await tenantDs.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'READY_FOR_PICKUP') as "readyForPickupCount",
        COUNT(*) FILTER (WHERE status IN ('WAITLISTED', 'ALLOCATED')) as "pendingReservationsCount"
       FROM "reservations"
       WHERE library_id = $1`,
      [libraryId],
    );

    return {
      activeLoansCount: parseInt(loansRes[0]?.activeLoansCount || '0', 10),
      overdueLoansCount: parseInt(loansRes[0]?.overdueLoansCount || '0', 10),
      readyForPickupCount: parseInt(resRes[0]?.readyForPickupCount || '0', 10),
      pendingReservationsCount: parseInt(resRes[0]?.pendingReservationsCount || '0', 10),
    };
  }

  /**
   * Retrieves reader-specific circulation dashboard (active loans, reservations, limits).
   */
  async getReaderCirculation(
    organizationId: string,
    libraryId: string,
    readerUserId: string,
  ): Promise<{
    activeLoans: LoanDto[];
    reservations: ReservationDto[];
    stats: {
      activeLoansCount: number;
      maxActiveLoans: number;
      pendingReservationsCount: number;
      maxPendingReservations: number;
    };
  }> {
    const policy = await this.getCirculationPolicy(organizationId, libraryId);
    const { items: activeLoans } = await this.getLoans(organizationId, libraryId, {
      readerUserId,
      status: LoanStatus.ACTIVE,
    });
    const { items: reservations } = await this.getReservations(organizationId, libraryId, {
      readerUserId,
    });

    const pendingRes = reservations.filter((r) =>
      [ReservationStatus.WAITLISTED, ReservationStatus.ALLOCATED, ReservationStatus.READY_FOR_PICKUP].includes(r.status),
    );

    return {
      activeLoans,
      reservations,
      stats: {
        activeLoansCount: activeLoans.length,
        maxActiveLoans: policy.maxActiveLoans,
        pendingReservationsCount: pendingRes.length,
        maxPendingReservations: policy.maxPendingReservations,
      },
    };
  }
}

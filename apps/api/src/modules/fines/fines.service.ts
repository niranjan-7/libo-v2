import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import { TenantConnectionService } from '../tenant-connection/tenant-connection.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { WalletService } from '../wallet/wallet.service';
import {
  FineDto,
  FineType,
  FineStatus,
  GenerateOverdueFinesResponse,
} from '@library/contracts';
import {
  FinesQueryDto,
  CreateManualFineDto,
  PayFineDto,
  WaiveFineDto,
} from './dto/fines.dto';

const DEFAULT_POLICY = {
  dailyOverdueFineRate: 10.0,
  currencyCode: 'INR',
};

@Injectable()
export class FinesService {
  private readonly logger = new Logger(FinesService.name);

  constructor(
    private readonly tenantConnectionService: TenantConnectionService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly walletService: WalletService,
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

  private async getCirculationPolicy(manager: EntityManager, libraryId: string) {
    const rows = await manager.query(
      `SELECT "value" FROM "library_settings" WHERE "library_id" = $1 AND "setting_key" = 'circulation_policy'`,
      [libraryId],
    );

    if (rows.length === 0 || !rows[0].value) {
      return { ...DEFAULT_POLICY };
    }

    const val = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
    return {
      dailyOverdueFineRate: Number(val.dailyOverdueFineRate ?? DEFAULT_POLICY.dailyOverdueFineRate),
      currencyCode: String(val.currencyCode ?? DEFAULT_POLICY.currencyCode),
    };
  }

  /**
   * Queries library fines with filters for readers or circulation desk staff.
   */
  async getFines(
    organizationId: string,
    libraryId: string,
    query: FinesQueryDto,
  ): Promise<{ items: FineDto[]; total: number; totalOutstanding: number }> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    const { readerUserId, status, loanId, limit = 50, offset = 0 } = query;

    const where = [`f.library_id = $1`];
    const params: any[] = [libraryId];
    let pIdx = 2;

    if (readerUserId) {
      where.push(`f.reader_user_id = $${pIdx}`);
      params.push(readerUserId);
      pIdx++;
    }

    if (status) {
      where.push(`f.status = $${pIdx}`);
      params.push(status);
      pIdx++;
    }

    if (loanId) {
      where.push(`f.loan_id = $${pIdx}`);
      params.push(loanId);
      pIdx++;
    }

    if (query.fineType) {
      where.push(`f.fine_type = $${pIdx}`);
      params.push(query.fineType);
      pIdx++;
    }

    const baseSql = `
      FROM "fines" f
      LEFT JOIN "loans" l ON l.loan_id = f.loan_id
      LEFT JOIN "book_copies" c ON c.copy_id = l.copy_id
      LEFT JOIN "book_editions" e ON e.edition_id = c.edition_id
      LEFT JOIN "books" b ON b.book_id = e.book_id
      WHERE ${where.join(' AND ')}
    `;

    const countRes = await tenantDs.query(
      `SELECT
        COUNT(*) as total,
        COALESCE(SUM(f.outstanding_amount), 0) as "totalOutstanding"
       ${baseSql}`,
      params,
    );

    const total = parseInt(countRes[0]?.total || '0', 10);
    const totalOutstanding = parseFloat(countRes[0]?.totalOutstanding || '0');

    const selectSql = `
      SELECT
        f.*,
        b.title as "bookTitle",
        c.barcode,
        e.edition_label as "editionLabel"
      ${baseSql}
      ORDER BY (f.status = 'UNPAID') DESC, f.created_at DESC
      LIMIT $${pIdx} OFFSET $${pIdx + 1}
    `;

    const rows = await tenantDs.query(selectSql, [...params, limit, offset]);

    const items: FineDto[] = rows.map((r: any) => ({
      fineId: r.fine_id,
      libraryId: r.library_id,
      readerUserId: r.reader_user_id,
      loanId: r.loan_id,
      bookTitle: r.bookTitle || undefined,
      barcode: r.barcode || undefined,
      fineType: r.fine_type as FineType,
      fineDate: r.fine_date ? new Date(r.fine_date).toISOString().split('T')[0] : null,
      amount: parseFloat(r.amount),
      outstandingAmount: parseFloat(r.outstanding_amount),
      status: r.status as FineStatus,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    }));

    return { items, total, totalOutstanding };
  }

  /**
   * Creates a manual fine liability (e.g. Damage fee, Lost copy charge, Manual adjustment).
   */
  async createManualFine(
    organizationId: string,
    libraryId: string,
    staffUserId: string,
    dto: CreateManualFineDto,
  ): Promise<FineDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    return tenantDs.transaction(async (manager) => {
      const fine = this.extractRow(
        await manager.query(
          `INSERT INTO "fines" (
            "library_id", "reader_user_id", "loan_id", "fine_type", "amount", "outstanding_amount", "status", "created_at", "updated_at"
          ) VALUES ($1, $2, $3, $4, $5, $5, 'UNPAID', NOW(), NOW())
          RETURNING *`,
          [
            libraryId,
            dto.readerUserId,
            dto.loanId || null,
            dto.fineType,
            dto.amount.toFixed(2),
          ],
        ),
      );

      // Record Audit Log
      await this.auditService.log(
        organizationId,
        {
          libraryId,
          actorUserId: staffUserId,
          action: 'CREATE_MANUAL_FINE',
          entityType: 'FINE',
          entityId: fine.fine_id,
          newValue: {
            readerUserId: dto.readerUserId,
            fineType: dto.fineType,
            amount: dto.amount,
            notes: dto.notes,
          },
        },
        manager,
      );

      // Emit Notification
      await this.notificationsService.createNotification(
        organizationId,
        {
          userId: dto.readerUserId,
          libraryId,
          eventType: 'FINE_INCURRED',
          title: `Library Fine Assessed: ${dto.fineType}`,
          body: `A fine of ${dto.amount.toFixed(2)} was charged for ${dto.notes || dto.fineType}. Outstanding: ${dto.amount.toFixed(2)}.`,
          dedupeKey: `notif-fine-${fine.fine_id}`,
          payload: { fineId: fine.fine_id, amount: dto.amount },
        },
        manager,
      );

      return {
        fineId: fine.fine_id,
        libraryId: fine.library_id,
        readerUserId: fine.reader_user_id,
        loanId: fine.loan_id,
        fineType: fine.fine_type,
        fineDate: null,
        amount: parseFloat(fine.amount),
        outstandingAmount: parseFloat(fine.outstanding_amount),
        status: FineStatus.UNPAID,
        createdAt: new Date(fine.created_at).toISOString(),
        updatedAt: new Date(fine.updated_at).toISOString(),
      };
    });
  }

  /**
   * Idempotent Overdue Fine Engine:
   * Specification requirement: Make overdue-fine generation idempotent so the same
   * reader/copy/day cannot be charged twice. An extension must not erase already accrued fines.
   * Uses unique index (loan_id, fine_date, fine_type) with ON CONFLICT DO NOTHING.
   */
  async generateOverdueFines(
    organizationId: string,
    libraryId: string,
  ): Promise<GenerateOverdueFinesResponse> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    return tenantDs.transaction(async (manager) => {
      const policy = await this.getCirculationPolicy(manager, libraryId);
      const dailyRate = policy.dailyOverdueFineRate;

      // Find all active loans that are overdue (due_at < NOW())
      const overdueLoans = await manager.query(
        `SELECT l.*, c.barcode, b.title as "bookTitle"
         FROM "loans" l
         JOIN "book_copies" c ON c.copy_id = l.copy_id
         JOIN "book_editions" e ON e.edition_id = c.edition_id
         JOIN "books" b ON b.book_id = e.book_id
         WHERE l.library_id = $1 AND l.status IN ('ACTIVE', 'OVERDUE') AND l.due_at < NOW()
         FOR UPDATE OF l`,
        [libraryId],
      );

      let finesGeneratedCount = 0;
      let totalFineAmount = 0;
      const now = new Date();

      for (const loan of overdueLoans) {
        // Mark loan status OVERDUE if still ACTIVE
        if (loan.status === 'ACTIVE') {
          await manager.query(`UPDATE "loans" SET "status" = 'OVERDUE' WHERE "loan_id" = $1`, [loan.loan_id]);
        }

        const dueDate = new Date(loan.due_at);
        const dayDifference = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (dayDifference <= 0) continue;

        let loanNewFines = 0;

        // Iterate through each overdue day up to today
        for (let dayOffset = 1; dayOffset <= dayDifference; dayOffset++) {
          const fineDateObj = new Date(dueDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
          const fineDateStr = fineDateObj.toISOString().split('T')[0];

          // Idempotent insertion protected by idx_unique_daily_overdue_fine
          const insertRes = await manager.query(
            `INSERT INTO "fines" (
              "library_id", "reader_user_id", "loan_id", "fine_type", "fine_date",
              "amount", "outstanding_amount", "status", "created_at", "updated_at"
            ) VALUES ($1, $2, $3, 'OVERDUE_DAILY', $4, $5, $5, 'UNPAID', NOW(), NOW())
            ON CONFLICT ("loan_id", "fine_date", "fine_type") WHERE "fine_date" IS NOT NULL DO NOTHING
            RETURNING "fine_id"`,
            [libraryId, loan.reader_user_id, loan.loan_id, fineDateStr, dailyRate.toFixed(2)],
          );

          if (insertRes.length > 0) {
            finesGeneratedCount++;
            loanNewFines++;
            totalFineAmount += dailyRate;
          }
        }

        // Notify reader if new overdue fine occurred
        if (loanNewFines > 0) {
          const todayStr = now.toISOString().split('T')[0];
          await this.notificationsService.createNotification(
            organizationId,
            {
              userId: loan.reader_user_id,
              libraryId,
              eventType: 'LOAN_OVERDUE_FINE',
              title: `Overdue Fine Assessed: ${loan.bookTitle}`,
              body: `Your loan for "${loan.bookTitle}" (${loan.barcode}) is overdue. Accrued daily fine: ${policy.currencyCode} ${(loanNewFines * dailyRate).toFixed(2)}.`,
              dedupeKey: `notif-overdue-${loan.loan_id}-${todayStr}`,
              payload: { loanId: loan.loan_id, newFinesCount: loanNewFines, dailyRate },
            },
            manager,
          );
        }
      }

      this.logger.log(
        `Overdue fine generator for library ${libraryId}: checked ${overdueLoans.length} overdue loans, generated ${finesGeneratedCount} fines (${policy.currencyCode} ${totalFineAmount.toFixed(2)}).`,
      );

      return {
        finesGeneratedCount,
        totalFineAmount,
        loansCheckedCount: overdueLoans.length,
      };
    });
  }

  /**
   * Settles an outstanding fine using reader's branch wallet balance.
   * Requirement: Fine debt is distinct from payments.
   * Transactionally checks balance, debits wallet (append-only ledger), and updates fine status to PAID.
   */
  async payFine(
    organizationId: string,
    libraryId: string,
    actorUserId: string,
    fineId: string,
    dto: PayFineDto,
  ): Promise<{ fine: FineDto; newWalletBalance: number }> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    return tenantDs.transaction(async (manager) => {
      // 1. Lock Fine FOR UPDATE
      const fineRows = await manager.query(
        `SELECT * FROM "fines" WHERE "fine_id" = $1 AND "library_id" = $2 FOR UPDATE`,
        [fineId, libraryId],
      );

      if (fineRows.length === 0) {
        throw new NotFoundException(`Fine '${fineId}' not found`);
      }
      const fine = fineRows[0];

      if ([FineStatus.PAID, FineStatus.WAIVED].includes(fine.status)) {
        throw new BadRequestException(`Cannot settle fine: current status is already ${fine.status}`);
      }

      const outstanding = parseFloat(fine.outstanding_amount);
      if (outstanding <= 0) {
        throw new BadRequestException('Fine has no outstanding balance');
      }

      // 2. Lock Reader's Wallet FOR UPDATE
      const wallet = await this.walletService.getOrCreateWallet(manager, libraryId, fine.reader_user_id);
      const [lockedWallet] = await manager.query(
        `SELECT * FROM "wallets" WHERE "wallet_id" = $1 FOR UPDATE`,
        [wallet.wallet_id],
      );

      const walletBalance = parseFloat(lockedWallet.balance_cache || '0');

      if (walletBalance < outstanding) {
        throw new BadRequestException(
          `Insufficient wallet balance (${lockedWallet.currency_code} ${walletBalance.toFixed(2)}) to settle fine of ${lockedWallet.currency_code} ${outstanding.toFixed(2)}. Please top up your wallet first.`,
        );
      }

      const newWalletBalance = walletBalance - outstanding;
      const idempotencyKey = dto.idempotencyKey || `pay-${fineId}-${randomUUID()}`;

      // 3. Deduct wallet balance
      await manager.query(
        `UPDATE "wallets" SET "balance_cache" = $1, "updated_at" = NOW() WHERE "wallet_id" = $2`,
        [newWalletBalance.toFixed(2), wallet.wallet_id],
      );

      // 4. Append DEBIT transaction to wallet_transactions ledger
      const tx = this.extractRow(
        await manager.query(
          `INSERT INTO "wallet_transactions" (
            "wallet_id", "fine_id", "loan_id", "transaction_type", "direction", "amount",
            "currency_code", "idempotency_key", "notes", "created_at"
          ) VALUES ($1, $2, $3, 'FINE_SETTLEMENT', 'DEBIT', $4, $5, $6, $7, NOW())
          RETURNING *`,
          [
            wallet.wallet_id,
            fine.fine_id,
            fine.loan_id,
            outstanding.toFixed(2),
            lockedWallet.currency_code,
            idempotencyKey,
            `Settlement for fine (${fine.fine_type})`,
          ],
        ),
      );

      // 5. Update fine state to PAID
      const updatedFine = this.extractRow(
        await manager.query(
          `UPDATE "fines"
           SET "outstanding_amount" = 0.00, "status" = 'PAID', "updated_at" = NOW()
           WHERE "fine_id" = $1
           RETURNING *`,
          [fineId],
        ),
      );

      // 6. Record Audit Log
      await this.auditService.log(
        organizationId,
        {
          libraryId,
          actorUserId,
          action: 'PAY_FINE',
          entityType: 'FINE',
          entityId: fineId,
          oldValue: { status: fine.status, outstanding_amount: outstanding },
          newValue: {
            status: 'PAID',
            outstanding_amount: 0,
            transactionId: tx.transaction_id,
            paidAmount: outstanding,
          },
        },
        manager,
      );

      // 7. Emit Notification
      await this.notificationsService.createNotification(
        organizationId,
        {
          userId: fine.reader_user_id,
          libraryId,
          eventType: 'FINE_PAID_SUCCESS',
          title: `Fine Settled (${lockedWallet.currency_code} ${outstanding.toFixed(2)})`,
          body: `Fine for ${fine.fine_type} was paid from your wallet. Remaining balance: ${lockedWallet.currency_code} ${newWalletBalance.toFixed(2)}.`,
          dedupeKey: `notif-fine-paid-${fineId}`,
          payload: { fineId, paidAmount: outstanding, newWalletBalance },
        },
        manager,
      );

      return {
        fine: {
          fineId: updatedFine.fine_id,
          libraryId: updatedFine.library_id,
          readerUserId: updatedFine.reader_user_id,
          loanId: updatedFine.loan_id,
          fineType: updatedFine.fine_type,
          fineDate: updatedFine.fine_date ? new Date(updatedFine.fine_date).toISOString().split('T')[0] : null,
          amount: parseFloat(updatedFine.amount),
          outstandingAmount: 0.0,
          status: FineStatus.PAID,
          createdAt: new Date(updatedFine.created_at).toISOString(),
          updatedAt: new Date(updatedFine.updated_at).toISOString(),
        },
        newWalletBalance,
      };
    });
  }

  /**
   * Waives an outstanding fine debt.
   * Requirement: Fine waivers must record the actor, reason, timestamp, and ledger effects.
   * Updates fine status to WAIVED, outstanding to 0, and writes immutable audit entry.
   */
  async waiveFine(
    organizationId: string,
    libraryId: string,
    staffUserId: string,
    fineId: string,
    dto: WaiveFineDto,
  ): Promise<FineDto> {
    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('A non-empty waiver reason is required to waive library fines');
    }

    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    return tenantDs.transaction(async (manager) => {
      // 1. Lock Fine FOR UPDATE
      const fineRows = await manager.query(
        `SELECT * FROM "fines" WHERE "fine_id" = $1 AND "library_id" = $2 FOR UPDATE`,
        [fineId, libraryId],
      );

      if (fineRows.length === 0) {
        throw new NotFoundException(`Fine '${fineId}' not found`);
      }
      const fine = fineRows[0];

      if ([FineStatus.PAID, FineStatus.WAIVED].includes(fine.status)) {
        throw new BadRequestException(`Cannot waive fine: current status is already ${fine.status}`);
      }

      const previousOutstanding = parseFloat(fine.outstanding_amount);

      // 2. Update Fine status to WAIVED and outstanding to 0
      const updatedFine = this.extractRow(
        await manager.query(
          `UPDATE "fines"
           SET "status" = 'WAIVED', "outstanding_amount" = 0.00, "updated_at" = NOW()
           WHERE "fine_id" = $1
           RETURNING *`,
          [fineId],
        ),
      );

      // 3. Record Immutable Audit Log with actor, reason, timestamp, and ledger effects
      await this.auditService.log(
        organizationId,
        {
          libraryId,
          actorUserId: staffUserId,
          action: 'WAIVE_FINE',
          entityType: 'FINE',
          entityId: fineId,
          oldValue: {
            status: fine.status,
            outstanding_amount: previousOutstanding,
          },
          newValue: {
            status: 'WAIVED',
            outstanding_amount: 0.0,
            waivedAmount: previousOutstanding,
            reason: dto.reason.trim(),
            waivedByStaffUserId: staffUserId,
            waivedAt: new Date().toISOString(),
          },
        },
        manager,
      );

      // 4. Emit Notification to reader
      await this.notificationsService.createNotification(
        organizationId,
        {
          userId: fine.reader_user_id,
          libraryId,
          eventType: 'FINE_WAIVED',
          title: `Fine Waived: ${fine.fine_type}`,
          body: `Your fine of ${previousOutstanding.toFixed(2)} was waived by staff. Reason: "${dto.reason.trim()}".`,
          dedupeKey: `notif-fine-waived-${fineId}`,
          payload: { fineId, waivedAmount: previousOutstanding, reason: dto.reason.trim() },
        },
        manager,
      );

      this.logger.log(
        `Fine ${fineId} waived by staff ${staffUserId} for reader ${fine.reader_user_id}. Reason: "${dto.reason.trim()}"`,
      );

      return {
        fineId: updatedFine.fine_id,
        libraryId: updatedFine.library_id,
        readerUserId: updatedFine.reader_user_id,
        loanId: updatedFine.loan_id,
        fineType: updatedFine.fine_type,
        fineDate: updatedFine.fine_date ? new Date(updatedFine.fine_date).toISOString().split('T')[0] : null,
        amount: parseFloat(updatedFine.amount),
        outstandingAmount: 0.0,
        status: FineStatus.WAIVED,
        createdAt: new Date(updatedFine.created_at).toISOString(),
        updatedAt: new Date(updatedFine.updated_at).toISOString(),
      };
    });
  }

  /**
   * Retrieves a single fine by ID.
   */
  async getFineById(
    organizationId: string,
    libraryId: string,
    fineId: string,
  ): Promise<FineDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    const rows = await tenantDs.query(
      `SELECT
        f.*,
        b.title as "bookTitle",
        c.barcode
       FROM "fines" f
       LEFT JOIN "loans" l ON l.loan_id = f.loan_id
       LEFT JOIN "book_copies" c ON c.copy_id = l.copy_id
       LEFT JOIN "book_editions" e ON e.edition_id = c.edition_id
       LEFT JOIN "books" b ON b.book_id = e.book_id
       WHERE f.fine_id = $1 AND f.library_id = $2`,
      [fineId, libraryId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Fine '${fineId}' not found`);
    }

    const r = rows[0];
    return {
      fineId: r.fine_id,
      libraryId: r.library_id,
      readerUserId: r.reader_user_id,
      loanId: r.loan_id,
      bookTitle: r.bookTitle || undefined,
      barcode: r.barcode || undefined,
      fineType: r.fine_type as FineType,
      fineDate: r.fine_date ? new Date(r.fine_date).toISOString().split('T')[0] : null,
      amount: parseFloat(r.amount),
      outstandingAmount: parseFloat(r.outstanding_amount),
      status: r.status as FineStatus,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    };
  }
}

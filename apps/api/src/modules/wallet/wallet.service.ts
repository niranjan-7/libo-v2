import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import { TenantConnectionService } from '../tenant-connection/tenant-connection.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import {
  WalletDto,
  WalletTransactionDto,
  WalletTransactionType,
  LedgerDirection,
} from '@library/contracts';
import { TopUpDto, WalletTransactionsQueryDto } from './dto/wallet.dto';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly tenantConnectionService: TenantConnectionService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Helper to ensure an isolated branch wallet exists for a user.
   */
  async getOrCreateWallet(
    em: EntityManager,
    libraryId: string,
    userId: string,
    defaultCurrency = 'INR',
  ): Promise<any> {
    const rows = await em.query(
      `INSERT INTO "wallets" ("library_id", "user_id", "currency_code", "balance_cache")
       VALUES ($1, $2, $3, 0.00)
       ON CONFLICT ("library_id", "user_id")
       DO UPDATE SET "updated_at" = NOW()
       RETURNING *`,
      [libraryId, userId, defaultCurrency],
    );
    return rows[0];
  }

  /**
   * Retrieves branch wallet for reader.
   */
  async getWallet(
    organizationId: string,
    libraryId: string,
    userId: string,
  ): Promise<WalletDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    const wallet = await this.getOrCreateWallet(tenantDs.manager, libraryId, userId);

    return {
      walletId: wallet.wallet_id,
      libraryId: wallet.library_id,
      userId: wallet.user_id,
      currencyCode: wallet.currency_code,
      balance: parseFloat(wallet.balance_cache || '0'),
      createdAt: new Date(wallet.created_at).toISOString(),
      updatedAt: new Date(wallet.updated_at).toISOString(),
    };
  }

  /**
   * Retrieves append-only transaction ledger for reader's branch wallet.
   */
  async getTransactions(
    organizationId: string,
    libraryId: string,
    userId: string,
    query: WalletTransactionsQueryDto = {},
  ): Promise<{ items: WalletTransactionDto[]; total: number; balance: number }> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    const wallet = await this.getOrCreateWallet(tenantDs.manager, libraryId, userId);
    const { limit = 50, offset = 0 } = query;

    const countRes = await tenantDs.query(
      `SELECT COUNT(*) as total FROM "wallet_transactions" WHERE "wallet_id" = $1`,
      [wallet.wallet_id],
    );
    const total = parseInt(countRes[0]?.total || '0', 10);

    const rows = await tenantDs.query(
      `SELECT * FROM "wallet_transactions"
       WHERE "wallet_id" = $1
       ORDER BY "created_at" DESC
       LIMIT $2 OFFSET $3`,
      [wallet.wallet_id, limit, offset],
    );

    const items: WalletTransactionDto[] = rows.map((r: any) => ({
      transactionId: r.transaction_id,
      walletId: r.wallet_id,
      fineId: r.fine_id,
      loanId: r.loan_id,
      transactionType: r.transaction_type as WalletTransactionType,
      direction: r.direction as LedgerDirection,
      amount: parseFloat(r.amount),
      currencyCode: r.currency_code,
      idempotencyKey: r.idempotency_key,
      notes: r.notes,
      createdAt: new Date(r.created_at).toISOString(),
    }));

    return {
      items,
      total,
      balance: parseFloat(wallet.balance_cache || '0'),
    };
  }

  /**
   * Simulates an instant wallet top-up.
   * Requirement: Simulated top-ups only (no real payment provider).
   * Appends an immutable CREDIT transaction in wallet_transactions and updates balance_cache transactionally.
   * Idempotent based on idempotency_key.
   */
  async topUp(
    organizationId: string,
    libraryId: string,
    userId: string,
    dto: TopUpDto,
  ): Promise<{ wallet: WalletDto; transaction: WalletTransactionDto; isDuplicate: boolean }> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const idempotencyKey = dto.idempotencyKey?.trim() || `topup-${randomUUID()}`;

    return tenantDs.transaction(async (manager) => {
      // 1. Check idempotency: if transaction exists with this key, return without double-crediting
      const existingTx = await manager.query(
        `SELECT * FROM "wallet_transactions" WHERE "idempotency_key" = $1`,
        [idempotencyKey],
      );

      const wallet = await this.getOrCreateWallet(manager, libraryId, userId);

      if (existingTx.length > 0) {
        this.logger.log(`Idempotent top-up replay: key '${idempotencyKey}' already processed.`);
        const tx = existingTx[0];
        return {
          wallet: {
            walletId: wallet.wallet_id,
            libraryId: wallet.library_id,
            userId: wallet.user_id,
            currencyCode: wallet.currency_code,
            balance: parseFloat(wallet.balance_cache || '0'),
            createdAt: new Date(wallet.created_at).toISOString(),
            updatedAt: new Date(wallet.updated_at).toISOString(),
          },
          transaction: {
            transactionId: tx.transaction_id,
            walletId: tx.wallet_id,
            fineId: tx.fine_id,
            loanId: tx.loan_id,
            transactionType: tx.transaction_type,
            direction: tx.direction,
            amount: parseFloat(tx.amount),
            currencyCode: tx.currency_code,
            idempotencyKey: tx.idempotency_key,
            notes: tx.notes,
            createdAt: new Date(tx.created_at).toISOString(),
          },
          isDuplicate: true,
        };
      }

      // 2. Lock wallet FOR UPDATE
      const [lockedWallet] = await manager.query(
        `SELECT * FROM "wallets" WHERE "wallet_id" = $1 FOR UPDATE`,
        [wallet.wallet_id],
      );

      const currentBalance = parseFloat(lockedWallet.balance_cache || '0');
      const newBalance = currentBalance + dto.amount;

      // 3. Update wallet balance
      await manager.query(
        `UPDATE "wallets" SET "balance_cache" = $1, "updated_at" = NOW() WHERE "wallet_id" = $2`,
        [newBalance.toFixed(2), wallet.wallet_id],
      );

      // 4. Append transaction
      const [tx] = await manager.query(
        `INSERT INTO "wallet_transactions" (
          "wallet_id", "transaction_type", "direction", "amount", "currency_code", "idempotency_key", "notes", "created_at"
        ) VALUES ($1, 'TOPUP', 'CREDIT', $2, $3, $4, $5, NOW())
        RETURNING *`,
        [
          wallet.wallet_id,
          dto.amount.toFixed(2),
          lockedWallet.currency_code,
          idempotencyKey,
          dto.notes || 'Simulated balance top-up',
        ],
      );

      // 5. Emit Notification
      await this.notificationsService.createNotification(
        organizationId,
        {
          userId,
          libraryId,
          eventType: 'WALLET_TOPUP_SUCCESS',
          title: `Wallet Credited (+${lockedWallet.currency_code} ${dto.amount.toFixed(2)})`,
          body: `Your simulated wallet balance is now ${lockedWallet.currency_code} ${newBalance.toFixed(2)}.`,
          dedupeKey: `notif-topup-${tx.transaction_id}`,
          payload: { transactionId: tx.transaction_id, amount: dto.amount, newBalance },
        },
        manager,
      );

      // 6. Record Audit Log
      await this.auditService.log(
        organizationId,
        {
          libraryId,
          actorUserId: userId,
          action: 'WALLET_TOPUP',
          entityType: 'WALLET',
          entityId: wallet.wallet_id,
          oldValue: { balance: currentBalance },
          newValue: { balance: newBalance, amount: dto.amount, transactionId: tx.transaction_id },
        },
        manager,
      );

      return {
        wallet: {
          walletId: lockedWallet.wallet_id,
          libraryId: lockedWallet.library_id,
          userId: lockedWallet.user_id,
          currencyCode: lockedWallet.currency_code,
          balance: newBalance,
          createdAt: new Date(lockedWallet.created_at).toISOString(),
          updatedAt: new Date().toISOString(),
        },
        transaction: {
          transactionId: tx.transaction_id,
          walletId: tx.wallet_id,
          fineId: tx.fine_id,
          loanId: tx.loan_id,
          transactionType: tx.transaction_type,
          direction: tx.direction,
          amount: parseFloat(tx.amount),
          currencyCode: tx.currency_code,
          idempotencyKey: tx.idempotency_key,
          notes: tx.notes,
          createdAt: new Date(tx.created_at).toISOString(),
        },
        isDuplicate: false,
      };
    });
  }
}

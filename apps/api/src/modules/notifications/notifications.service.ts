import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TenantConnectionService } from '../tenant-connection/tenant-connection.service';
import {
  NotificationDto,
  NotificationDeliveryDto,
  NotificationChannel,
  NotificationDeliveryStatus,
} from '@library/contracts';
import { CreateNotificationDto, NotificationsQueryDto } from './dto/notifications.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly tenantConnectionService: TenantConnectionService) {}

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
   * Idempotently creates an in-app and simulated email notification with dedupeKey.
   */
  async createNotification(
    organizationId: string,
    dto: CreateNotificationDto,
    manager?: EntityManager,
  ): Promise<NotificationDto> {
    const doCreate = async (em: EntityManager): Promise<NotificationDto> => {
      // 1. Check if notification with dedupeKey already exists
      const existing = await em.query(
        `SELECT * FROM "notifications" WHERE "dedupe_key" = $1`,
        [dto.dedupeKey],
      );

      let notificationRow: any;

      if (existing.length > 0) {
        notificationRow = existing[0];
        this.logger.debug(`Notification with dedupeKey '${dto.dedupeKey}' already exists. Idempotent skip.`);
      } else {
        // Insert new notification
        const [inserted] = await em.query(
          `INSERT INTO "notifications" (
            "user_id", "library_id", "event_type", "title", "body", "payload", "dedupe_key", "created_at"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          RETURNING *`,
          [
            dto.userId,
            dto.libraryId || null,
            dto.eventType,
            dto.title,
            dto.body,
            JSON.stringify(dto.payload || {}),
            dto.dedupeKey,
          ],
        );
        notificationRow = inserted;

        // 2. Create pending deliveries for requested channels
        const channels = dto.channels && dto.channels.length > 0
          ? dto.channels
          : [NotificationChannel.IN_APP, NotificationChannel.EMAIL];

        for (const channel of channels) {
          // In-App channel delivers immediately on creation; email is queued as pending
          const isInstantInApp = channel === NotificationChannel.IN_APP;
          await em.query(
            `INSERT INTO "notification_deliveries" (
              "notification_id", "channel", "status", "attempt_count", "sent_at", "error_message"
            ) VALUES ($1, $2, $3, $4, $5, NULL)`,
            [
              notificationRow.notification_id,
              channel,
              isInstantInApp ? NotificationDeliveryStatus.SENT : NotificationDeliveryStatus.PENDING,
              isInstantInApp ? 1 : 0,
              isInstantInApp ? new Date().toISOString() : null,
            ],
          );
        }
      }

      // Fetch deliveries
      const deliveries = await em.query(
        `SELECT * FROM "notification_deliveries" WHERE "notification_id" = $1`,
        [notificationRow.notification_id],
      );

      return this.mapNotification(notificationRow, deliveries);
    };

    if (manager) {
      return doCreate(manager);
    }

    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    return doCreate(tenantDs.manager);
  }

  /**
   * Retrieves notification inbox for a user with unread counter.
   */
  async getUserNotifications(
    organizationId: string,
    userId: string,
    query: NotificationsQueryDto = {},
  ): Promise<{ items: NotificationDto[]; total: number; unreadCount: number }> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    const { limit = 50, offset = 0, unreadOnly } = query;

    const where: string[] = [`"user_id" = $1`];
    const params: any[] = [userId];
    let pIdx = 2;

    if (unreadOnly) {
      where.push(`"read_at" IS NULL`);
    }

    const whereClause = where.join(' AND ');

    const countRes = await tenantDs.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE "read_at" IS NULL) as "unreadCount"
       FROM "notifications"
       WHERE ${whereClause}`,
      params,
    );

    const total = parseInt(countRes[0]?.total || '0', 10);
    const unreadCount = parseInt(countRes[0]?.unreadCount || '0', 10);

    const rows = await tenantDs.query(
      `SELECT * FROM "notifications"
       WHERE ${whereClause}
       ORDER BY "created_at" DESC
       LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
      [...params, limit, offset],
    );

    const notificationIds = rows.map((r: any) => r.notification_id);
    let deliveriesByNotifId: Record<string, any[]> = {};

    if (notificationIds.length > 0) {
      const delRows = await tenantDs.query(
        `SELECT * FROM "notification_deliveries" WHERE "notification_id" = ANY($1)`,
        [notificationIds],
      );
      for (const d of delRows) {
        if (!deliveriesByNotifId[d.notification_id]) deliveriesByNotifId[d.notification_id] = [];
        deliveriesByNotifId[d.notification_id].push(d);
      }
    }

    const items = rows.map((r: any) => this.mapNotification(r, deliveriesByNotifId[r.notification_id] || []));

    return { items, total, unreadCount };
  }

  /**
   * Marks a notification as read.
   */
  async markAsRead(
    organizationId: string,
    userId: string,
    notificationId: string,
  ): Promise<NotificationDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const rows = await tenantDs.query(
      `UPDATE "notifications"
       SET "read_at" = NOW()
       WHERE "notification_id" = $1 AND "user_id" = $2
       RETURNING *`,
      [notificationId, userId],
    );

    const row = this.extractRow(rows);
    if (!row || !row.notification_id) {
      throw new NotFoundException(`Notification '${notificationId}' not found for user`);
    }

    const deliveries = await tenantDs.query(
      `SELECT * FROM "notification_deliveries" WHERE "notification_id" = $1`,
      [notificationId],
    );

    return this.mapNotification(row, deliveries);
  }

  /**
   * Marks all notifications as read for a user.
   */
  async markAllAsRead(organizationId: string, userId: string): Promise<{ affectedCount: number }> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const res = await tenantDs.query(
      `UPDATE "notifications"
       SET "read_at" = NOW()
       WHERE "user_id" = $1 AND "read_at" IS NULL`,
      [userId],
    );

    return { affectedCount: Array.isArray(res) ? res[1] || 0 : res?.rowCount || 0 };
  }

  /**
   * Processes pending notification deliveries with retry backoff and failure logging.
   */
  async processDeliveries(
    organizationId: string,
    simulateFailuresForChannels: NotificationChannel[] = [],
  ): Promise<{ processedCount: number; sentCount: number; failedCount: number }> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    return tenantDs.transaction(async (manager) => {
      // Find pending deliveries or failed deliveries that haven't reached max 3 attempts
      const deliveries = await manager.query(
        `SELECT d.*, n.title, n.user_id
         FROM "notification_deliveries" d
         JOIN "notifications" n ON n.notification_id = d.notification_id
         WHERE d.status IN ('PENDING', 'FAILED') AND d.attempt_count < 3
         ORDER BY d.delivery_id ASC
         LIMIT 100
         FOR UPDATE OF d`,
      );

      let sentCount = 0;
      let failedCount = 0;

      for (const d of deliveries) {
        const attempt = d.attempt_count + 1;
        const willSimulateFailure = simulateFailuresForChannels.includes(d.channel as NotificationChannel);

        if (willSimulateFailure) {
          // Observable failure recorded with message
          const newStatus = attempt >= 3 ? NotificationDeliveryStatus.FAILED : NotificationDeliveryStatus.FAILED;
          await manager.query(
            `UPDATE "notification_deliveries"
             SET "status" = $1, "attempt_count" = $2, "error_message" = $3
             WHERE "delivery_id" = $4`,
            [newStatus, attempt, `SMTP Connection Timeout (Simulated Attempt ${attempt}/3)`, d.delivery_id],
          );
          failedCount++;
        } else {
          // Success
          await manager.query(
            `UPDATE "notification_deliveries"
             SET "status" = 'SENT', "attempt_count" = $1, "sent_at" = NOW(), "error_message" = NULL
             WHERE "delivery_id" = $2`,
            [attempt, d.delivery_id],
          );
          sentCount++;
        }
      }

      this.logger.log(
        `Processed ${deliveries.length} notification deliveries: ${sentCount} sent, ${failedCount} failed/retrying.`,
      );

      return {
        processedCount: deliveries.length,
        sentCount,
        failedCount,
      };
    });
  }

  private mapNotification(row: any, deliveries: any[]): NotificationDto {
    return {
      notificationId: row.notification_id,
      userId: row.user_id,
      libraryId: row.library_id,
      eventType: row.event_type,
      title: row.title,
      body: row.body,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || {},
      dedupeKey: row.dedupe_key,
      readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
      deliveries: deliveries.map((d: any) => ({
        deliveryId: d.delivery_id,
        notificationId: d.notification_id,
        channel: d.channel as NotificationChannel,
        status: d.status as NotificationDeliveryStatus,
        attemptCount: d.attempt_count,
        sentAt: d.sent_at ? new Date(d.sent_at).toISOString() : null,
        errorMessage: d.error_message,
      })),
    };
  }
}

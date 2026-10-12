import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TenantConnectionService } from '../tenant-connection/tenant-connection.service';
import { SystemAuditLogDto } from '@library/contracts';

export interface LogAuditParams {
  libraryId?: string | null;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  traceId?: string | null;
}

export interface AuditQueryOptions {
  libraryId?: string;
  actorUserId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly tenantConnectionService: TenantConnectionService) {}

  /**
   * Appends an immutable system audit log entry into the tenant database.
   * Can be executed with an active transactional EntityManager or directly.
   */
  async log(
    organizationId: string,
    params: LogAuditParams,
    manager?: EntityManager,
  ): Promise<SystemAuditLogDto> {
    const doLog = async (em: EntityManager) => {
      const [row] = await em.query(
        `INSERT INTO "system_audit_logs" (
          "library_id", "actor_user_id", "action", "entity_type", "entity_id",
          "old_value", "new_value", "trace_id", "created_at"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *`,
        [
          params.libraryId || null,
          params.actorUserId,
          params.action,
          params.entityType,
          params.entityId,
          params.oldValue ? JSON.stringify(params.oldValue) : null,
          params.newValue ? JSON.stringify(params.newValue) : null,
          params.traceId || null,
        ],
      );

      this.logger.log(
        `Audit Log: [${params.action}] on ${params.entityType}:${params.entityId} by user ${params.actorUserId}`,
      );

      return {
        auditId: row.audit_id,
        libraryId: row.library_id,
        actorUserId: row.actor_user_id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        oldValue: row.old_value,
        newValue: row.new_value,
        traceId: row.trace_id,
        createdAt: new Date(row.created_at).toISOString(),
      };
    };

    if (manager) {
      return doLog(manager);
    }

    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    return doLog(tenantDs.manager);
  }

  /**
   * Queries audit logs with pagination and filters.
   */
  async queryLogs(
    organizationId: string,
    options: AuditQueryOptions,
  ): Promise<{ items: SystemAuditLogDto[]; total: number }> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    const { libraryId, actorUserId, action, entityType, entityId, limit = 50, offset = 0 } = options;

    const where: string[] = ['1=1'];
    const params: any[] = [];
    let pIdx = 1;

    if (libraryId) {
      where.push(`"library_id" = $${pIdx}`);
      params.push(libraryId);
      pIdx++;
    }

    if (actorUserId) {
      where.push(`"actor_user_id" = $${pIdx}`);
      params.push(actorUserId);
      pIdx++;
    }

    if (action) {
      where.push(`"action" = $${pIdx}`);
      params.push(action);
      pIdx++;
    }

    if (entityType) {
      where.push(`"entity_type" = $${pIdx}`);
      params.push(entityType);
      pIdx++;
    }

    if (entityId) {
      where.push(`"entity_id" = $${pIdx}`);
      params.push(entityId);
      pIdx++;
    }

    const whereClause = where.join(' AND ');

    const countRes = await tenantDs.query(
      `SELECT COUNT(*) as total FROM "system_audit_logs" WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countRes[0]?.total || '0', 10);

    const queryParams = [...params, limit, offset];
    const rows = await tenantDs.query(
      `SELECT * FROM "system_audit_logs"
       WHERE ${whereClause}
       ORDER BY "created_at" DESC
       LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
      queryParams,
    );

    const items: SystemAuditLogDto[] = rows.map((r: any) => ({
      auditId: r.audit_id,
      libraryId: r.library_id,
      actorUserId: r.actor_user_id,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      oldValue: typeof r.old_value === 'string' ? JSON.parse(r.old_value) : r.old_value,
      newValue: typeof r.new_value === 'string' ? JSON.parse(r.new_value) : r.new_value,
      traceId: r.trace_id,
      createdAt: new Date(r.created_at).toISOString(),
    }));

    return { items, total };
  }
}

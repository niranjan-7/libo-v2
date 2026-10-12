import {
  Injectable,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { FinesService } from '../fines/fines.service';
import { CirculationService } from '../circulation/circulation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { JobRunResultDto, NotificationChannel } from '@library/contracts';

@Injectable()
export class BackgroundJobsService {
  private readonly logger = new Logger(BackgroundJobsService.name);

  // In-flight mutex locks to prevent duplicate job execution per org/library
  private readonly runningJobs = new Set<string>();

  constructor(
    private readonly finesService: FinesService,
    private readonly circulationService: CirculationService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  private getJobLockKey(jobName: string, orgId: string, libraryId?: string): string {
    return `${jobName}:${orgId}:${libraryId || 'all'}`;
  }

  private acquireLock(jobName: string, orgId: string, libraryId?: string): void {
    const key = this.getJobLockKey(jobName, orgId, libraryId);
    if (this.runningJobs.has(key)) {
      throw new ConflictException(
        `Job '${jobName}' is currently executing for this branch. Duplicate execution prevented.`,
      );
    }
    this.runningJobs.add(key);
  }

  private releaseLock(jobName: string, orgId: string, libraryId?: string): void {
    const key = this.getJobLockKey(jobName, orgId, libraryId);
    this.runningJobs.delete(key);
  }

  /**
   * Executes daily overdue fine generation with lock protection against duplicate runs.
   */
  async runOverdueFineSweep(
    organizationId: string,
    libraryId: string,
    actorUserId = '00000000-0000-0000-0000-000000000000',
  ): Promise<JobRunResultDto> {
    const jobName = 'OVERDUE_FINE_SWEEP';
    this.acquireLock(jobName, organizationId, libraryId);

    const start = Date.now();
    try {
      const result = await this.finesService.generateOverdueFines(organizationId, libraryId);
      const durationMs = Date.now() - start;

      // Log system audit
      await this.auditService.log(organizationId, {
        libraryId,
        actorUserId,
        action: 'BACKGROUND_JOB_OVERDUE_FINES',
        entityType: 'JOB',
        entityId: '00000000-0000-0000-0000-000000000000',
        newValue: { ...result, durationMs },
      });

      return {
        jobName,
        success: true,
        executedAt: new Date().toISOString(),
        durationMs,
        metrics: result,
      };
    } catch (err: any) {
      const durationMs = Date.now() - start;
      this.logger.error(`Job ${jobName} failed: ${err.message}`, err.stack);
      return {
        jobName,
        success: false,
        executedAt: new Date().toISOString(),
        durationMs,
        metrics: {},
        error: err.message,
      };
    } finally {
      this.releaseLock(jobName, organizationId, libraryId);
    }
  }

  /**
   * Executes 72-hour hold expiry sweep and reassignments.
   */
  async runHoldExpirySweep(
    organizationId: string,
    libraryId: string,
    actorUserId = '00000000-0000-0000-0000-000000000000',
  ): Promise<JobRunResultDto> {
    const jobName = 'HOLD_EXPIRY_SWEEP';
    this.acquireLock(jobName, organizationId, libraryId);

    const start = Date.now();
    try {
      const result = await this.circulationService.processExpiries(organizationId, libraryId);
      const durationMs = Date.now() - start;

      await this.auditService.log(organizationId, {
        libraryId,
        actorUserId,
        action: 'BACKGROUND_JOB_HOLD_EXPIRIES',
        entityType: 'JOB',
        entityId: '00000000-0000-0000-0000-000000000000',
        newValue: { ...result, durationMs },
      });

      return {
        jobName,
        success: true,
        executedAt: new Date().toISOString(),
        durationMs,
        metrics: result,
      };
    } catch (err: any) {
      const durationMs = Date.now() - start;
      return {
        jobName,
        success: false,
        executedAt: new Date().toISOString(),
        durationMs,
        metrics: {},
        error: err.message,
      };
    } finally {
      this.releaseLock(jobName, organizationId, libraryId);
    }
  }

  /**
   * Executes notification delivery sweep with safe retries and failure logging.
   */
  async runNotificationDeliverySweep(
    organizationId: string,
    libraryId?: string,
    simulateFailuresForChannels: NotificationChannel[] = [],
  ): Promise<JobRunResultDto> {
    const jobName = 'NOTIFICATION_DELIVERY_SWEEP';
    this.acquireLock(jobName, organizationId, libraryId);

    const start = Date.now();
    try {
      const result = await this.notificationsService.processDeliveries(
        organizationId,
        simulateFailuresForChannels,
      );
      const durationMs = Date.now() - start;

      return {
        jobName,
        success: true,
        executedAt: new Date().toISOString(),
        durationMs,
        metrics: result,
      };
    } catch (err: any) {
      const durationMs = Date.now() - start;
      return {
        jobName,
        success: false,
        executedAt: new Date().toISOString(),
        durationMs,
        metrics: {},
        error: err.message,
      };
    } finally {
      this.releaseLock(jobName, organizationId, libraryId);
    }
  }

  /**
   * Status check of active running jobs.
   */
  getActiveJobs(): string[] {
    return Array.from(this.runningJobs);
  }
}

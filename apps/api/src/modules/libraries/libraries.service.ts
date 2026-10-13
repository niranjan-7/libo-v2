import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LibraryDirectoryEntryDto,
  ReaderAccessRequestDto,
  UserLibraryMembershipDto,
  OrgRole,
} from '@library/contracts';
import { LibraryDirectoryEntity } from '../../database/control-plane/entities/library-directory.entity';
import { OrganizationEntity } from '../../database/control-plane/entities/organization.entity';
import { OrgMembershipEntity } from '../../database/control-plane/entities/org-membership.entity';
import { UserEntity } from '../../database/control-plane/entities/user.entity';
import { TenantConnectionService } from '../tenant-connection/tenant-connection.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAccessRequestDto, ReviewAccessRequestDto } from './dto/access-request.dto';

@Injectable()
export class LibrariesService {
  private readonly logger = new Logger(LibrariesService.name);

  constructor(
    @InjectRepository(LibraryDirectoryEntity)
    private readonly libDirRepo: Repository<LibraryDirectoryEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly orgRepo: Repository<OrganizationEntity>,
    @InjectRepository(OrgMembershipEntity)
    private readonly orgMembershipRepo: Repository<OrgMembershipEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly tenantConnectionService: TenantConnectionService,
    private readonly notificationsService: NotificationsService,
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
   * Retrieves all discoverable libraries across the system.
   * If userId is provided, annotates each with the user's membership or request status.
   */
  async getDirectory(userId?: string): Promise<LibraryDirectoryEntryDto[]> {
    const libraries = await this.libDirRepo.find({
      order: { created_at: 'ASC' },
      relations: ['organization'],
    });

    const results: LibraryDirectoryEntryDto[] = [];

    for (const lib of libraries) {
      let membershipStatus: 'ACTIVE' | 'PENDING' | 'REJECTED' | 'NONE' = 'NONE';
      let pendingRequestId: string | undefined;

      if (userId) {
        try {
          const tenantDs = await this.tenantConnectionService.getTenantConnection(lib.organization_id);

          // 1. Check if user is active member
          const memberRows = await tenantDs.query(
            `SELECT role, status FROM "library_memberships" 
             WHERE "library_id" = $1 AND "user_id" = $2`,
            [lib.library_id, userId],
          );

          if (memberRows.length > 0 && memberRows[0].status === 'ACTIVE') {
            membershipStatus = 'ACTIVE';
          } else {
            // 2. Check latest access request
            const requestRows = await tenantDs.query(
              `SELECT request_id, status FROM "reader_access_requests"
               WHERE "library_id" = $1 AND "user_id" = $2
               ORDER BY "created_at" DESC LIMIT 1`,
              [lib.library_id, userId],
            );

            if (requestRows.length > 0) {
              if (requestRows[0].status === 'PENDING') {
                membershipStatus = 'PENDING';
                pendingRequestId = requestRows[0].request_id;
              } else if (requestRows[0].status === 'REJECTED') {
                membershipStatus = 'REJECTED';
              }
            }
          }
        } catch (err: any) {
          this.logger.warn(`Could not inspect tenant for directory annotation: ${err.message}`);
        }
      }

      results.push({
        libraryId: lib.library_id,
        organizationId: lib.organization_id,
        organizationName: lib.organization?.name || 'Library Organization',
        name: lib.name,
        slug: lib.slug,
        timezone: lib.timezone,
        status: lib.status,
        membershipStatus,
        pendingRequestId,
        createdAt: lib.created_at.toISOString(),
      });
    }

    return results;
  }

  /**
   * Retrieves all libraries where the user has active membership across organizations.
   * Enables reader direct login and switching without needing organization dropdowns.
   */
  async getMyLibraries(userId: string): Promise<UserLibraryMembershipDto[]> {
    // 1. Find all organizations user is part of
    const orgMemberships = await this.orgMembershipRepo.find({
      where: { user_id: userId, status: 'ACTIVE' },
      relations: ['organization'],
    });

    const results: UserLibraryMembershipDto[] = [];

    for (const om of orgMemberships) {
      if (!om.organization) continue;
      try {
        const tenantDs = await this.tenantConnectionService.getTenantConnection(om.organization_id);
        const libRows = await tenantDs.query(
          `SELECT lm.library_id, lm.role, lm.status, lm.joined_at,
                  l.name as library_name, l.slug as library_slug
           FROM "library_memberships" lm
           JOIN "libraries" l ON l.library_id = lm.library_id
           WHERE lm.user_id = $1 AND lm.status = 'ACTIVE'`,
          [userId],
        );

        for (const row of libRows) {
          results.push({
            libraryId: row.library_id,
            libraryName: row.library_name,
            librarySlug: row.library_slug,
            organizationId: om.organization_id,
            organizationName: om.organization.name,
            organizationSlug: om.organization.slug,
            role: row.role,
            status: row.status,
            joinedAt: new Date(row.joined_at).toISOString(),
          });
        }
      } catch (err: any) {
        this.logger.warn(`Error querying tenant libraries for user ${userId}: ${err.message}`);
      }
    }

    return results;
  }

  /**
   * Reader submits an access request to join an existing library.
   */
  async submitAccessRequest(
    userId: string,
    libraryId: string,
    dto: CreateAccessRequestDto,
  ): Promise<ReaderAccessRequestDto> {
    const libEntry = await this.libDirRepo.findOne({
      where: { library_id: libraryId },
      relations: ['organization'],
    });

    if (!libEntry) {
      throw new NotFoundException(`Library ${libraryId} not found in directory`);
    }

    const user = await this.userRepo.findOne({ where: { user_id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const tenantDs = await this.tenantConnectionService.getTenantConnection(libEntry.organization_id);

    // 1. Check if already active member
    const existingMember = await tenantDs.query(
      `SELECT status FROM "library_memberships" WHERE "library_id" = $1 AND "user_id" = $2`,
      [libraryId, userId],
    );
    if (existingMember.length > 0 && existingMember[0].status === 'ACTIVE') {
      throw new ConflictException('You are already an active member of this library');
    }

    // 2. Check if already pending request
    const existingReq = await tenantDs.query(
      `SELECT request_id FROM "reader_access_requests" 
       WHERE "library_id" = $1 AND "user_id" = $2 AND "status" = 'PENDING'`,
      [libraryId, userId],
    );
    if (existingReq.length > 0) {
      throw new ConflictException('You already have a pending access request for this library');
    }

    // 3. Create access request record
    const applicantName = user.display_name || user.email;
    const applicantEmail = user.email;

    const insertRes = await tenantDs.query(
      `INSERT INTO "reader_access_requests" (
        "library_id", "user_id", "applicant_name", "applicant_email", "notes", "status", "created_at"
      ) VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW())
      RETURNING *`,
      [libraryId, userId, applicantName, applicantEmail, dto.notes || null],
    );
    const saved = this.extractRow(insertRes);

    // 4. Notify library staff (Librarians in tenant DB and Admins/Owners in control plane)
    try {
      const staffRows = await tenantDs.query(
        `SELECT DISTINCT user_id FROM "library_memberships"
         WHERE "library_id" = $1 AND "role" = 'LIBRARIAN' AND "status" = 'ACTIVE'`,
        [libraryId],
      );

      const orgStaff = await this.orgMembershipRepo.find({
        where: { organization_id: libEntry.organization_id, status: 'ACTIVE' },
      });

      const recipientUserIds = new Set<string>();
      staffRows.forEach((r: any) => recipientUserIds.add(r.user_id));
      orgStaff
        .filter((os) => os.role === OrgRole.OWNER || os.role === OrgRole.ADMIN)
        .forEach((os) => recipientUserIds.add(os.user_id));

      for (const staffId of recipientUserIds) {
        await this.notificationsService.createNotification(libEntry.organization_id, {
          userId: staffId,
          libraryId,
          eventType: 'READER_ACCESS_REQUEST_PENDING',
          title: 'New Reader Access Request',
          body: `${applicantName} has requested membership access to ${libEntry.name}.`,
          payload: {
            requestId: saved.request_id,
            applicantName,
            applicantEmail,
            libraryId,
          },
          dedupeKey: `req-pending-${saved.request_id}-${staffId}`,
        });
      }
    } catch (notifyErr: any) {
      this.logger.warn(`Could not dispatch staff notifications for access request: ${notifyErr.message}`);
    }

    return this.mapToRequestDto(saved, libEntry.name, libEntry.organization_id);
  }

  /**
   * Retrieves all reader access requests for a library branch (staff desk).
   */
  async getAccessRequests(
    orgId: string,
    libraryId: string,
    actorUserId: string,
  ): Promise<ReaderAccessRequestDto[]> {
    await this.verifyStaffAccess(orgId, libraryId, actorUserId);

    const tenantDs = await this.tenantConnectionService.getTenantConnection(orgId);
    const rows = await tenantDs.query(
      `SELECT rar.*, l.name as library_name
       FROM "reader_access_requests" rar
       JOIN "libraries" l ON l.library_id = rar.library_id
       WHERE rar.library_id = $1
       ORDER BY rar.created_at DESC`,
      [libraryId],
    );

    return rows.map((r: any) => this.mapToRequestDto(r, r.library_name, orgId));
  }

  /**
   * Staff approves reader access request atomically.
   */
  async approveAccessRequest(
    orgId: string,
    libraryId: string,
    requestId: string,
    actorUserId: string,
  ): Promise<ReaderAccessRequestDto> {
    await this.verifyStaffAccess(orgId, libraryId, actorUserId);

    const tenantDs = await this.tenantConnectionService.getTenantConnection(orgId);

    const [request] = await tenantDs.query(
      `SELECT * FROM "reader_access_requests" WHERE "request_id" = $1 AND "library_id" = $2`,
      [requestId, libraryId],
    );

    if (!request) {
      throw new NotFoundException(`Access request ${requestId} not found`);
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(`This access request has already been ${request.status.toLowerCase()}`);
    }

    // 1. Transactionally update request, provision library membership, and reader profile in tenant DB
    const queryRunner = tenantDs.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let updatedRequest: any;
    try {
      const updateRes = await queryRunner.query(
        `UPDATE "reader_access_requests"
         SET "status" = 'APPROVED', "reviewed_by_user_id" = $1, "reviewed_at" = NOW()
         WHERE "request_id" = $2
         RETURNING *`,
        [actorUserId, requestId],
      );
      updatedRequest = this.extractRow(updateRes);

      // Upsert library membership as READER
      await queryRunner.query(
        `INSERT INTO "library_memberships" ("library_id", "user_id", "role", "status", "joined_at")
         VALUES ($1, $2, 'READER', 'ACTIVE', NOW())
         ON CONFLICT ("library_id", "user_id") 
         DO UPDATE SET "role" = 'READER', "status" = 'ACTIVE'`,
        [libraryId, request.user_id],
      );

      // Upsert reader profile
      await queryRunner.query(
        `INSERT INTO "reader_profiles" ("user_id", "display_name")
         VALUES ($1, $2)
         ON CONFLICT ("user_id") 
         DO UPDATE SET "display_name" = EXCLUDED."display_name"`,
        [request.user_id, request.applicant_name],
      );

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    // 2. Ensure user has Org Membership in control plane so auth guards allow tenant access
    const existingOrgMembership = await this.orgMembershipRepo.findOne({
      where: { organization_id: orgId, user_id: request.user_id },
    });

    if (!existingOrgMembership) {
      const newOm = this.orgMembershipRepo.create({
        organization_id: orgId,
        user_id: request.user_id,
        role: OrgRole.MEMBER,
        status: 'ACTIVE',
      });
      await this.orgMembershipRepo.save(newOm);
    }

    // 3. Dispatch in-app notification to reader
    try {
      const [lib] = await tenantDs.query(
        `SELECT name FROM "libraries" WHERE "library_id" = $1`,
        [libraryId],
      );
      const libraryName = lib?.name || 'Library';

      await this.notificationsService.createNotification(orgId, {
        userId: request.user_id,
        libraryId,
        eventType: 'ACCESS_REQUEST_APPROVED',
        title: 'Library Access Approved!',
        body: `Your request to join ${libraryName} has been approved. You can now borrow books and access catalog services.`,
        payload: {
          libraryId,
          libraryName,
          requestId,
        },
        dedupeKey: `req-approved-${requestId}`,
      });
    } catch (notifyErr: any) {
      this.logger.warn(`Could not dispatch approval notification: ${notifyErr.message}`);
    }

    return this.mapToRequestDto(updatedRequest, undefined, orgId);
  }

  /**
   * Staff rejects reader access request with optional feedback reason.
   */
  async rejectAccessRequest(
    orgId: string,
    libraryId: string,
    requestId: string,
    actorUserId: string,
    dto: ReviewAccessRequestDto,
  ): Promise<ReaderAccessRequestDto> {
    await this.verifyStaffAccess(orgId, libraryId, actorUserId);

    const tenantDs = await this.tenantConnectionService.getTenantConnection(orgId);

    const [request] = await tenantDs.query(
      `SELECT * FROM "reader_access_requests" WHERE "request_id" = $1 AND "library_id" = $2`,
      [requestId, libraryId],
    );

    if (!request) {
      throw new NotFoundException(`Access request ${requestId} not found`);
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(`This access request has already been ${request.status.toLowerCase()}`);
    }

    const updateRes = await tenantDs.query(
      `UPDATE "reader_access_requests"
       SET "status" = 'REJECTED',
           "reviewed_by_user_id" = $1,
           "reviewed_at" = NOW(),
           "rejection_reason" = $2
       WHERE "request_id" = $3
       RETURNING *`,
      [actorUserId, dto.reason || null, requestId],
    );
    const updated = this.extractRow(updateRes);

    // Dispatch in-app notification to reader
    try {
      const [lib] = await tenantDs.query(
        `SELECT name FROM "libraries" WHERE "library_id" = $1`,
        [libraryId],
      );
      const libraryName = lib?.name || 'Library';

      await this.notificationsService.createNotification(orgId, {
        userId: request.user_id,
        libraryId,
        eventType: 'ACCESS_REQUEST_REJECTED',
        title: 'Library Access Request Update',
        body: `Your membership request for ${libraryName} was not approved.${dto.reason ? ` Note: ${dto.reason}` : ''}`,
        payload: {
          libraryId,
          libraryName,
          reason: dto.reason,
        },
        dedupeKey: `req-rejected-${requestId}`,
      });
    } catch (notifyErr: any) {
      this.logger.warn(`Could not dispatch rejection notification: ${notifyErr.message}`);
    }

    return this.mapToRequestDto(updated, undefined, orgId);
  }

  /**
   * Helper: verify actor is staff (OWNER/ADMIN in control plane or LIBRARIAN in tenant)
   */
  private async verifyStaffAccess(
    orgId: string,
    libraryId: string,
    actorUserId: string,
  ): Promise<void> {
    const orgMembership = await this.orgMembershipRepo.findOne({
      where: { organization_id: orgId, user_id: actorUserId, status: 'ACTIVE' },
    });

    if (orgMembership && (orgMembership.role === OrgRole.OWNER || orgMembership.role === OrgRole.ADMIN)) {
      return;
    }

    const tenantDs = await this.tenantConnectionService.getTenantConnection(orgId);
    const libMemberships = await tenantDs.query(
      `SELECT role FROM "library_memberships" 
       WHERE "library_id" = $1 AND "user_id" = $2 AND "status" = 'ACTIVE'`,
      [libraryId, actorUserId],
    );

    if (libMemberships.length > 0 && libMemberships[0].role === 'LIBRARIAN') {
      return;
    }

    throw new ForbiddenException('Access denied: Staff permissions (Librarian, Admin, or Owner) required.');
  }

  private mapToRequestDto(row: any, libraryName?: string, organizationId?: string): ReaderAccessRequestDto {
    const raw = this.extractRow(row);
    return {
      requestId: raw.request_id,
      libraryId: raw.library_id,
      libraryName: libraryName || raw.library_name,
      organizationId,
      userId: raw.user_id,
      applicantName: raw.applicant_name,
      applicantEmail: raw.applicant_email,
      notes: raw.notes || undefined,
      status: raw.status,
      reviewedByUserId: raw.reviewed_by_user_id || undefined,
      reviewedAt: raw.reviewed_at ? new Date(raw.reviewed_at).toISOString() : undefined,
      rejectionReason: raw.rejection_reason || undefined,
      createdAt: raw.created_at ? new Date(raw.created_at).toISOString() : new Date().toISOString(),
    };
  }
}

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as crypto from 'crypto';
import {
  OrgRole,
  OrganizationDto,
  LibraryDto,
  OrganizationDetailsResponse,
  OrganizationMemberDto,
} from '@library/contracts';
import { OrganizationEntity } from '../../database/control-plane/entities/organization.entity';
import { OrgMembershipEntity } from '../../database/control-plane/entities/org-membership.entity';
import { OrgInvitationEntity } from '../../database/control-plane/entities/org-invitation.entity';
import { UserEntity } from '../../database/control-plane/entities/user.entity';
import { ControlPlaneAuditLogEntity } from '../../database/control-plane/entities/control-plane-audit.entity';
import { LibraryDirectoryEntity } from '../../database/control-plane/entities/library-directory.entity';
import { TenantDatabaseRegistryService } from '../control-plane/tenant-database-registry.service';
import { TenantConnectionService } from '../tenant-connection/tenant-connection.service';
import {
  CreateOrganizationDto,
  CreateLibraryDto,
  InviteMemberDto,
  UpdateMemberAccessDto,
} from './dto/organization.dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly orgRepo: Repository<OrganizationEntity>,
    @InjectRepository(OrgMembershipEntity)
    private readonly membershipRepo: Repository<OrgMembershipEntity>,
    @InjectRepository(OrgInvitationEntity)
    private readonly inviteRepo: Repository<OrgInvitationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(ControlPlaneAuditLogEntity)
    private readonly auditRepo: Repository<ControlPlaneAuditLogEntity>,
    private readonly registryService: TenantDatabaseRegistryService,
    private readonly tenantConnectionService: TenantConnectionService,
    @Optional()
    @InjectRepository(LibraryDirectoryEntity)
    private readonly libDirRepo?: Repository<LibraryDirectoryEntity>,
  ) {}

  /**
   * Creates an organization, assigns OWNER membership, provisions isolated tenant DB,
   * creates the first library in the tenant DB, and sets up reader profile.
   */
  async createOrganization(
    userId: string,
    dto: CreateOrganizationDto,
  ): Promise<OrganizationDetailsResponse> {
    const existingSlug = await this.orgRepo.findOne({ where: { slug: dto.slug } });
    if (existingSlug) {
      throw new ConflictException(`Organization slug '${dto.slug}' is already taken`);
    }

    const user = await this.userRepo.findOne({ where: { user_id: userId } });
    if (!user) {
      throw new NotFoundException('Creator user not found');
    }

    // 1. Create Organization in Control Plane
    const org = this.orgRepo.create({
      name: dto.name,
      slug: dto.slug,
      status: 'ACTIVE',
    });
    const savedOrg = await this.orgRepo.save(org);

    // 2. Assign OWNER membership
    const membership = this.membershipRepo.create({
      organization_id: savedOrg.organization_id,
      user_id: userId,
      role: OrgRole.OWNER,
      status: 'ACTIVE',
    });
    await this.membershipRepo.save(membership);

    // 3. Provision Tenant PostgreSQL Database
    await this.registryService.provisionTenantDatabase(savedOrg.organization_id, savedOrg.slug);

    // 4. Connect to the isolated tenant database and initialize first library
    const tenantDs = await this.tenantConnectionService.getTenantConnection(savedOrg.organization_id);

    const initialLibraryName = dto.initialLibraryName?.trim() || `${dto.name} Main Branch`;
    const librarySlug = 'main';
    const timezone = dto.timezone || 'Asia/Kolkata';

    const [createdLibrary] = await tenantDs.query(
      `INSERT INTO "libraries" ("name", "slug", "timezone", "status")
       VALUES ($1, $2, $3, 'ACTIVE')
       RETURNING *`,
      [initialLibraryName, librarySlug, timezone],
    );

    // 5. Create creator's library membership as LIBRARIAN
    await tenantDs.query(
      `INSERT INTO "library_memberships" ("library_id", "user_id", "role", "status")
       VALUES ($1, $2, 'LIBRARIAN', 'ACTIVE')`,
      [createdLibrary.library_id, userId],
    );

    // 6. Create creator's reader profile in tenant DB
    await tenantDs.query(
      `INSERT INTO "reader_profiles" ("user_id", "display_name")
       VALUES ($1, $2)
       ON CONFLICT ("user_id") DO UPDATE SET "display_name" = EXCLUDED."display_name"`,
      [userId, user.display_name || user.email],
    );

    // 7. Sync initial library to central directory for discovery
    if (this.libDirRepo) {
      try {
        await this.libDirRepo.save(
          this.libDirRepo.create({
            library_id: createdLibrary.library_id,
            organization_id: savedOrg.organization_id,
            name: createdLibrary.name,
            slug: createdLibrary.slug,
            timezone: createdLibrary.timezone || timezone,
            status: 'ACTIVE',
          }),
        );
      } catch (err: any) {
        this.logger.warn(`Failed to sync library directory on org creation: ${err.message}`);
      }
    }

    // 8. Audit log
    await this.auditRepo.save(
      this.auditRepo.create({
        organization_id: savedOrg.organization_id,
        actor_user_id: userId,
        action: 'ORGANIZATION_CREATED',
        metadata: {
          organizationName: savedOrg.name,
          slug: savedOrg.slug,
          initialLibraryId: createdLibrary.library_id,
        },
      }),
    );

    return {
      organization: this.mapToOrgDto(savedOrg),
      role: OrgRole.OWNER,
      libraries: [this.mapToLibraryDto(createdLibrary)],
    };
  }

  /**
   * Retrieves all organizations the user belongs to, along with their libraries.
   */
  async getUserOrganizations(userId: string): Promise<OrganizationDetailsResponse[]> {
    const memberships = await this.membershipRepo.find({
      where: { user_id: userId },
      relations: ['organization'],
      order: { joined_at: 'ASC' },
    });

    const results: OrganizationDetailsResponse[] = [];
    for (const m of memberships) {
      if (!m.organization) continue;
      const libraries = await this.getLibrariesForOrg(m.organization.organization_id);
      results.push({
        organization: this.mapToOrgDto(m.organization),
        role: m.role,
        libraries,
      });
    }

    return results;
  }

  /**
   * Retrieves organization details and all libraries (up to 3) for an authorized member.
   */
  async getOrganizationDetails(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationDetailsResponse> {
    const membership = await this.membershipRepo.findOne({
      where: { organization_id: organizationId, user_id: userId },
    });

    if (!membership) {
      throw new ForbiddenException('Access denied: You are not a member of this organization');
    }

    const org = await this.orgRepo.findOne({ where: { organization_id: organizationId } });
    if (!org) {
      throw new NotFoundException(`Organization ${organizationId} not found`);
    }

    const libraries = await this.getLibrariesForOrg(organizationId);

    return {
      organization: this.mapToOrgDto(org),
      role: membership.role,
      libraries,
    };
  }

  /**
   * Creates an additional library within the tenant database.
   * Enforces the hard 3-library limit at both the service layer and database trigger level.
   */
  async createLibrary(
    organizationId: string,
    userId: string,
    dto: CreateLibraryDto,
  ): Promise<LibraryDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    // 1. Service-level check of library count
    const countRes = await tenantDs.query(`SELECT COUNT(*) as count FROM "libraries"`);
    const currentCount = parseInt(countRes[0]?.count || '0', 10);
    if (currentCount >= 3) {
      throw new BadRequestException('Organization has reached the maximum allowed limit of 3 libraries');
    }

    // 2. Slug uniqueness within this tenant
    const existingSlug = await tenantDs.query(
      `SELECT library_id FROM "libraries" WHERE slug = $1`,
      [dto.slug],
    );
    if (existingSlug.length > 0) {
      throw new ConflictException(`A library with slug '${dto.slug}' already exists in this organization`);
    }

    // 3. Insert library (PostgreSQL trigger with pg_advisory_xact_lock enforces concurrency limit)
    try {
      const timezone = dto.timezone || 'Asia/Kolkata';
      const [newLib] = await tenantDs.query(
        `INSERT INTO "libraries" ("name", "slug", "timezone", "status")
         VALUES ($1, $2, $3, 'ACTIVE')
         RETURNING *`,
        [dto.name, dto.slug, timezone],
      );

      // Add creator to library membership as LIBRARIAN
      await tenantDs.query(
        `INSERT INTO "library_memberships" ("library_id", "user_id", "role", "status")
         VALUES ($1, $2, 'LIBRARIAN', 'ACTIVE')
         ON CONFLICT DO NOTHING`,
        [newLib.library_id, userId],
      );

      // Sync library to central directory for discovery
      if (this.libDirRepo) {
        try {
          await this.libDirRepo.save(
            this.libDirRepo.create({
              library_id: newLib.library_id,
              organization_id: organizationId,
              name: newLib.name,
              slug: newLib.slug,
              timezone: newLib.timezone || timezone,
              status: 'ACTIVE',
            }),
          );
        } catch (err: any) {
          this.logger.warn(`Failed to sync library directory on library creation: ${err.message}`);
        }
      }

      // Control plane audit log
      await this.auditRepo.save(
        this.auditRepo.create({
          organization_id: organizationId,
          actor_user_id: userId,
          action: 'LIBRARY_CREATED',
          metadata: {
            libraryId: newLib.library_id,
            libraryName: newLib.name,
            slug: newLib.slug,
          },
        }),
      );

      return this.mapToLibraryDto(newLib);
    } catch (err: any) {
      if (err.message && err.message.includes('three libraries')) {
        throw new BadRequestException('An organization cannot exceed the maximum limit of three libraries.');
      }
      throw err;
    }
  }

  /**
   * Invites a new member to the organization with a proposed role.
   */
  async inviteMember(
    organizationId: string,
    actorUserId: string,
    dto: InviteMemberDto,
  ) {
    // 1. Role hierarchy check
    const actorMembership = await this.membershipRepo.findOne({
      where: { organization_id: organizationId, user_id: actorUserId },
    });
    if (!actorMembership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    if (actorMembership.role === OrgRole.OWNER) {
      // Owner can invite ADMIN, LIBRARIAN, MEMBER
    } else if (actorMembership.role === OrgRole.ADMIN) {
      // Admin can invite LIBRARIAN or MEMBER, but CANNOT invite ADMIN or OWNER
      if (dto.proposedRole === OrgRole.ADMIN || (dto.proposedRole as string) === OrgRole.OWNER) {
        throw new ForbiddenException('Administrators cannot invite other Administrators or Owners');
      }
    } else {
      throw new ForbiddenException('Only Owners and Administrators can invite staff members');
    }

    // 2. Check if target is already a member
    const targetUser = await this.userRepo.findOne({ where: { email: dto.email } });
    if (targetUser) {
      const existing = await this.membershipRepo.findOne({
        where: { organization_id: organizationId, user_id: targetUser.user_id },
      });
      if (existing) {
        throw new ConflictException(`User '${dto.email}' is already a member of this organization`);
      }
    }

    // 3. Generate secure random invite token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = this.inviteRepo.create({
      organization_id: organizationId,
      email: dto.email,
      proposed_role: (dto.proposedRole === 'LIBRARIAN' ? OrgRole.MEMBER : dto.proposedRole) as OrgRole,
      target_library_id: dto.targetLibraryId || null,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    const saved = await this.inviteRepo.save(invitation);

    await this.auditRepo.save(
      this.auditRepo.create({
        organization_id: organizationId,
        actor_user_id: actorUserId,
        action: 'MEMBER_INVITED',
        metadata: {
          invitationId: saved.invitation_id,
          email: dto.email,
          proposedRole: dto.proposedRole,
        },
      }),
    );

    return {
      invitationId: saved.invitation_id,
      email: saved.email,
      proposedRole: dto.proposedRole,
      token: rawToken, // Caller receives token to share
      expiresAt: saved.expires_at.toISOString(),
    };
  }

  /**
   * Accepts an invitation using the secure invite token.
   */
  async acceptInvitation(userId: string, rawToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Find invitation by token hash or raw token
    let invite = await this.inviteRepo.findOne({
      where: { token_hash: tokenHash },
    });
    if (!invite) {
      invite = await this.inviteRepo.findOne({
        where: { token_hash: rawToken },
      });
    }

    if (!invite) {
      throw new NotFoundException('Invitation token is invalid');
    }

    if (invite.accepted_at) {
      throw new BadRequestException('This invitation has already been accepted');
    }

    if (new Date() > invite.expires_at) {
      throw new BadRequestException('This invitation token has expired');
    }

    const user = await this.userRepo.findOne({ where: { user_id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 1. Assign Org Membership
    let membership = await this.membershipRepo.findOne({
      where: { organization_id: invite.organization_id, user_id: userId },
    });

    if (!membership) {
      const assignedRole = (invite.proposed_role === ('LIBRARIAN' as any) ? OrgRole.MEMBER : invite.proposed_role) as OrgRole;
      membership = this.membershipRepo.create({
        organization_id: invite.organization_id,
        user_id: userId,
        role: assignedRole,
        status: 'ACTIVE',
      });
      await this.membershipRepo.save(membership);
    }

    // 2. Provision Reader profile & library membership in Tenant DB if targetLibraryId provided
    try {
      const tenantDs = await this.tenantConnectionService.getTenantConnection(invite.organization_id);
      await tenantDs.query(
        `INSERT INTO "reader_profiles" ("user_id", "display_name")
         VALUES ($1, $2)
         ON CONFLICT ("user_id") DO UPDATE SET "display_name" = EXCLUDED."display_name"`,
        [userId, user.display_name || user.email],
      );

      if (invite.target_library_id) {
        const libraryRole = (invite.proposed_role === OrgRole.ADMIN || (invite.proposed_role as string) === 'LIBRARIAN')
          ? 'LIBRARIAN'
          : 'READER';

        await tenantDs.query(
          `INSERT INTO "library_memberships" ("library_id", "user_id", "role", "status")
           VALUES ($1, $2, $3, 'ACTIVE')
           ON CONFLICT ("library_id", "user_id") DO UPDATE SET "role" = EXCLUDED."role", "status" = 'ACTIVE'`,
          [invite.target_library_id, userId, libraryRole],
        );
      }
    } catch (err) {
      this.logger.warn(`Could not sync tenant profile during invite acceptance: ${(err as Error).message}`);
    }

    // 3. Mark invite as accepted
    invite.accepted_at = new Date();
    await this.inviteRepo.save(invite);

    return {
      success: true,
      organizationId: invite.organization_id,
      role: membership.role,
    };
  }

  /**
   * Retrieves all members of an organization with user details.
   */
  async getMembers(orgId: string): Promise<OrganizationMemberDto[]> {
    const members = await this.membershipRepo.find({
      where: { organization_id: orgId },
      order: { joined_at: 'ASC' },
    });
    if (members.length === 0) return [];

    const userIds = members.map((m) => m.user_id);
    const users = await this.userRepo.find({ where: { user_id: In(userIds) } });
    const userMap = new Map(users.map((u) => [u.user_id, u]));

    // Query library memberships from tenant DB to annotate effective library role
    const libRoleMap = new Map<string, { role: string; status: string }>();
    try {
      const tenantDs = await this.tenantConnectionService.getTenantConnection(orgId);
      const rows = await tenantDs.query(
        `SELECT "user_id", "role", "status" FROM "library_memberships"`,
      );
      for (const r of rows) {
        libRoleMap.set(r.user_id, { role: r.role, status: r.status });
      }
    } catch (err: any) {
      this.logger.warn(`Could not load tenant library memberships for members view: ${err.message}`);
    }

    return members.map((m) => {
      const u = userMap.get(m.user_id);
      const libInfo = libRoleMap.get(m.user_id);
      const effectiveRole = m.role === OrgRole.OWNER
        ? OrgRole.OWNER
        : m.role === OrgRole.ADMIN
        ? OrgRole.ADMIN
        : libInfo?.role || OrgRole.MEMBER;

      return {
        userId: m.user_id,
        email: u?.email || '',
        displayName: u?.display_name || u?.email || 'User',
        role: effectiveRole,
        libraryRole: libInfo?.role,
        status: m.status,
        joinedAt: m.joined_at.toISOString(),
      };
    });
  }

  /**
   * Updates an existing member's role and/or status with role hierarchy gating.
   * - OWNER: can update any member's role (ADMIN, LIBRARIAN, READER/MEMBER) and status (ACTIVE, SUSPENDED), but cannot modify self.
   * - ADMIN: can promote/demote between LIBRARIAN and READER/MEMBER, and change status. Cannot modify OWNER or other ADMINs.
   */
  async updateMemberAccess(
    orgId: string,
    actorUserId: string,
    targetUserId: string,
    dto: UpdateMemberAccessDto,
  ) {
    if (actorUserId === targetUserId && dto.role && dto.role !== OrgRole.OWNER) {
      throw new BadRequestException('You cannot demote or remove your own ownership/admin role');
    }

    // 1. Check actor's membership
    const actorMembership = await this.membershipRepo.findOne({
      where: { organization_id: orgId, user_id: actorUserId },
    });
    if (!actorMembership || (actorMembership.role !== OrgRole.OWNER && actorMembership.role !== OrgRole.ADMIN)) {
      throw new ForbiddenException('Only Organization Owners and Admins can update member access');
    }

    // 2. Check target's membership
    const targetMembership = await this.membershipRepo.findOne({
      where: { organization_id: orgId, user_id: targetUserId },
    });
    if (!targetMembership) {
      throw new NotFoundException('Target member not found in this organization');
    }

    // Role hierarchy gating:
    if (actorMembership.role === OrgRole.ADMIN) {
      if (targetMembership.role === OrgRole.OWNER) {
        throw new ForbiddenException('Admins cannot modify the Organization Owner');
      }
      if (targetMembership.role === OrgRole.ADMIN && targetUserId !== actorUserId) {
        throw new ForbiddenException('Admins cannot modify other Admins');
      }
      if (dto.role === OrgRole.ADMIN || dto.role === OrgRole.OWNER) {
        throw new ForbiddenException('Admins cannot promote members to Admin or Owner');
      }
    }

    const previousRole = targetMembership.role;
    const previousStatus = targetMembership.status;

    // 3. Update control-plane membership
    if (dto.role) {
      if (dto.role === OrgRole.ADMIN) {
        targetMembership.role = OrgRole.ADMIN;
      } else if (dto.role === 'LIBRARIAN' || dto.role === 'READER' || dto.role === OrgRole.MEMBER) {
        targetMembership.role = OrgRole.MEMBER;
      }
    }
    if (dto.status) {
      targetMembership.status = dto.status;
    }
    await this.membershipRepo.save(targetMembership);

    // 4. Update tenant database library_memberships
    try {
      const tenantDs = await this.tenantConnectionService.getTenantConnection(orgId);
      const targetLibRole = dto.role === OrgRole.ADMIN
        ? 'LIBRARIAN'
        : dto.role === 'LIBRARIAN'
        ? 'LIBRARIAN'
        : 'READER';

      if (dto.targetLibraryId) {
        await tenantDs.query(
          `UPDATE "library_memberships"
           SET "role" = COALESCE($1, "role"),
               "status" = COALESCE($2, "status")
           WHERE "library_id" = $3 AND "user_id" = $4`,
          [dto.role ? targetLibRole : null, dto.status || null, dto.targetLibraryId, targetUserId],
        );
      } else {
        await tenantDs.query(
          `UPDATE "library_memberships"
           SET "role" = COALESCE($1, "role"),
               "status" = COALESCE($2, "status")
           WHERE "user_id" = $3`,
          [dto.role ? targetLibRole : null, dto.status || null, targetUserId],
        );
      }
    } catch (err: any) {
      this.logger.warn(`Could not sync tenant library memberships: ${err.message}`);
    }

    // 5. Control-plane Audit Log
    await this.auditRepo.save(
      this.auditRepo.create({
        organization_id: orgId,
        actor_user_id: actorUserId,
        action: 'MEMBER_ACCESS_UPDATED',
        metadata: {
          targetUserId,
          previousRole,
          newRole: dto.role || previousRole,
          previousStatus,
          newStatus: dto.status || previousStatus,
        },
      }),
    );

    return {
      success: true,
      userId: targetUserId,
      role: dto.role || previousRole,
      status: dto.status || previousStatus,
    };
  }

  /**
   * Retrieves all invitations for an organization.
   */
  async getInvitations(orgId: string) {
    const invites = await this.inviteRepo.find({
      where: { organization_id: orgId },
      order: { created_at: 'DESC' },
    });

    return invites.map((i) => ({
      invitationId: i.invitation_id,
      email: i.email,
      proposedRole: i.proposed_role,
      targetLibraryId: i.target_library_id,
      expiresAt: i.expires_at.toISOString(),
      acceptedAt: i.accepted_at ? i.accepted_at.toISOString() : null,
      createdAt: i.created_at.toISOString(),
    }));
  }

  private async getLibrariesForOrg(organizationId: string): Promise<LibraryDto[]> {
    try {
      const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
      const rows = await tenantDs.query(
        `SELECT "library_id", "name", "slug", "timezone", "status", "created_at"
         FROM "libraries"
         ORDER BY "created_at" ASC`,
      );
      return rows.map((r: any) => this.mapToLibraryDto(r));
    } catch (err) {
      this.logger.error(`Failed to fetch libraries for org ${organizationId}: ${(err as Error).message}`);
      return [];
    }
  }

  private mapToOrgDto(org: OrganizationEntity): OrganizationDto {
    return {
      organizationId: org.organization_id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      createdAt: org.created_at.toISOString(),
    };
  }

  private mapToLibraryDto(row: any): LibraryDto {
    return {
      libraryId: row.library_id,
      name: row.name,
      slug: row.slug,
      timezone: row.timezone,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}

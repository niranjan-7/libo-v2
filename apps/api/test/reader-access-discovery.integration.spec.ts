import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { UserEntity } from '../src/database/control-plane/entities/user.entity';
import { OrganizationEntity } from '../src/database/control-plane/entities/organization.entity';
import { OrgMembershipEntity } from '../src/database/control-plane/entities/org-membership.entity';
import { OrgInvitationEntity } from '../src/database/control-plane/entities/org-invitation.entity';
import { TenantDatabaseRegistryEntity } from '../src/database/control-plane/entities/tenant-registry.entity';
import { ControlPlaneAuditLogEntity } from '../src/database/control-plane/entities/control-plane-audit.entity';
import { LibraryDirectoryEntity } from '../src/database/control-plane/entities/library-directory.entity';
import { TenantDatabaseRegistryService } from '../src/modules/control-plane/tenant-database-registry.service';
import { TenantConnectionService } from '../src/modules/tenant-connection/tenant-connection.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { OrganizationsService } from '../src/modules/organizations/organizations.service';
import { LibrariesService } from '../src/modules/libraries/libraries.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { OrgRole } from '@library/contracts';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('Reader Discovery, Access Requests & Staff Invite Hierarchy Integration Tests', () => {
  let controlPlaneDs: DataSource;
  let registryService: TenantDatabaseRegistryService;
  let connectionService: TenantConnectionService;
  let authService: AuthService;
  let orgsService: OrganizationsService;
  let librariesService: LibrariesService;
  let notificationsService: NotificationsService;
  let configService: ConfigService;

  let ownerUserId: string;
  let adminUserId: string;
  let readerUserId: string;
  let testOrgId: string;
  let testLibraryId: string;

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
        LibraryDirectoryEntity,
      ],
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
    const libDirRepo = controlPlaneDs.getRepository(LibraryDirectoryEntity);

    registryService = new TenantDatabaseRegistryService(registryRepo, controlPlaneDs, configService);
    connectionService = new TenantConnectionService(configService, registryService);
    authService = new AuthService(userRepo, membershipRepo, configService);
    notificationsService = new NotificationsService(connectionService);

    orgsService = new OrganizationsService(
      orgRepo,
      membershipRepo,
      inviteRepo,
      userRepo,
      auditRepo,
      registryService,
      connectionService,
      libDirRepo,
    );

    librariesService = new LibrariesService(
      libDirRepo,
      orgRepo,
      membershipRepo,
      userRepo,
      connectionService,
      notificationsService,
    );

    // Create unique test users
    const timestamp = Date.now();
    const ownerReg = await authService.register({
      email: `owner_${timestamp}@test.edu`,
      password: 'Password123!',
      displayName: 'System Owner',
    });
    ownerUserId = ownerReg.user.userId;

    const adminReg = await authService.register({
      email: `admin_${timestamp}@test.edu`,
      password: 'Password123!',
      displayName: 'Branch Administrator',
    });
    adminUserId = adminReg.user.userId;

    const readerReg = await authService.register({
      email: `reader_${timestamp}@test.edu`,
      password: 'Password123!',
      displayName: 'Independent Reader',
    });
    readerUserId = readerReg.user.userId;

    // Create an organization and first library
    const orgResult = await orgsService.createOrganization(ownerUserId, {
      name: `Discovery Test Org ${timestamp}`,
      slug: `disc-test-${timestamp}`.slice(0, 30),
      initialLibraryName: 'Discovery Central Branch',
      timezone: 'Asia/Kolkata',
    });

    testOrgId = orgResult.organization.organizationId;
    testLibraryId = orgResult.libraries[0].libraryId;

    // Add adminUserId to this org as ADMIN
    await membershipRepo.save(
      membershipRepo.create({
        organization_id: testOrgId,
        user_id: adminUserId,
        role: OrgRole.ADMIN,
        status: 'ACTIVE',
      }),
    );
  }, 60000);

  afterAll(async () => {
    if (controlPlaneDs && controlPlaneDs.isInitialized) {
      await controlPlaneDs.destroy();
    }
  });

  describe('1. Global Library Directory & Initial Reader State', () => {
    it('should list discoverable libraries for unauthenticated visitor', async () => {
      const directory = await librariesService.getDirectory();
      expect(directory.length).toBeGreaterThan(0);

      const targetLib = directory.find((l) => l.libraryId === testLibraryId);
      expect(targetLib).toBeDefined();
      expect(targetLib?.name).toBe('Discovery Central Branch');
      expect(targetLib?.membershipStatus).toBe('NONE');
    });

    it('should mark status as NONE for reader who has not joined yet', async () => {
      const directory = await librariesService.getDirectory(readerUserId);
      const targetLib = directory.find((l) => l.libraryId === testLibraryId);
      expect(targetLib?.membershipStatus).toBe('NONE');
      expect(targetLib?.pendingRequestId).toBeUndefined();
    });

    it('should show 0 libraries in getMyLibraries for independent reader before join', async () => {
      const myLibraries = await librariesService.getMyLibraries(readerUserId);
      const target = myLibraries.find((l) => l.libraryId === testLibraryId);
      expect(target).toBeUndefined();
    });
  });

  describe('2. Reader Access Request Submission', () => {
    let createdRequestId: string;

    it('should allow reader to submit an access request to join the library', async () => {
      const req = await librariesService.submitAccessRequest(readerUserId, testLibraryId, {
        notes: 'I am a local researcher requesting catalog borrowing access.',
      });

      expect(req.requestId).toBeDefined();
      expect(req.libraryId).toBe(testLibraryId);
      expect(req.userId).toBe(readerUserId);
      expect(req.status).toBe('PENDING');
      expect(req.applicantName).toBe('Independent Reader');
      expect(req.notes).toContain('researcher');

      createdRequestId = req.requestId;
    });

    it('should show PENDING status in directory for this reader', async () => {
      const directory = await librariesService.getDirectory(readerUserId);
      const targetLib = directory.find((l) => l.libraryId === testLibraryId);
      expect(targetLib?.membershipStatus).toBe('PENDING');
      expect(targetLib?.pendingRequestId).toBe(createdRequestId);
    });

    it('should prevent duplicate pending requests from the same reader (409 Conflict)', async () => {
      await expect(
        librariesService.submitAccessRequest(readerUserId, testLibraryId, {
          notes: 'Second attempt',
        }),
      ).rejects.toThrow('already have a pending access request');
    });

    it('should allow library staff (Admin) to see the pending request in review desk', async () => {
      const requests = await librariesService.getAccessRequests(testOrgId, testLibraryId, adminUserId);
      const pendingReq = requests.find((r) => r.requestId === createdRequestId);
      expect(pendingReq).toBeDefined();
      expect(pendingReq?.status).toBe('PENDING');
      expect(pendingReq?.applicantEmail).toContain('reader_');
    });
  });

  describe('3. Staff Approval & Reader Membership Activation', () => {
    it('should allow staff to approve the access request atomically', async () => {
      const requests = await librariesService.getAccessRequests(testOrgId, testLibraryId, adminUserId);
      const targetReq = requests.find((r) => r.userId === readerUserId && r.status === 'PENDING');
      expect(targetReq).toBeDefined();

      const approved = await librariesService.approveAccessRequest(
        testOrgId,
        testLibraryId,
        targetReq!.requestId,
        adminUserId,
      );

      expect(approved.status).toBe('APPROVED');
      expect(approved.reviewedByUserId).toBe(adminUserId);
    });

    it('should activate reader in library_memberships and reader_profiles in tenant DB', async () => {
      const tenantDs = await connectionService.getTenantConnection(testOrgId);
      const libMember = await tenantDs.query(
        `SELECT role, status FROM "library_memberships" WHERE "library_id" = $1 AND "user_id" = $2`,
        [testLibraryId, readerUserId],
      );
      expect(libMember.length).toBe(1);
      expect(libMember[0].role).toBe('READER');
      expect(libMember[0].status).toBe('ACTIVE');

      const profile = await tenantDs.query(
        `SELECT display_name FROM "reader_profiles" WHERE "user_id" = $1`,
        [readerUserId],
      );
      expect(profile.length).toBe(1);
      expect(profile[0].display_name).toBe('Independent Reader');
    });

    it('should now show ACTIVE membershipStatus in directory for reader', async () => {
      const directory = await librariesService.getDirectory(readerUserId);
      const targetLib = directory.find((l) => l.libraryId === testLibraryId);
      expect(targetLib?.membershipStatus).toBe('ACTIVE');
    });

    it('should return this library in getMyLibraries for reader direct login', async () => {
      const myLibraries = await librariesService.getMyLibraries(readerUserId);
      const target = myLibraries.find((l) => l.libraryId === testLibraryId);
      expect(target).toBeDefined();
      expect(target?.libraryName).toBe('Discovery Central Branch');
      expect(target?.role).toBe('READER');
      expect(target?.status).toBe('ACTIVE');
    });
  });

  describe('4. Staff Invitation Role Hierarchy Gating', () => {
    it('Owner should be able to invite an ADMIN', async () => {
      const result = await orgsService.inviteMember(testOrgId, ownerUserId, {
        email: `colleague_admin_${Date.now()}@test.edu`,
        proposedRole: OrgRole.ADMIN,
      });
      expect(result.invitationId).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it('Owner should be able to invite a LIBRARIAN', async () => {
      const result = await orgsService.inviteMember(testOrgId, ownerUserId, {
        email: `colleague_lib_${Date.now()}@test.edu`,
        proposedRole: 'LIBRARIAN',
        targetLibraryId: testLibraryId,
      });
      expect(result.invitationId).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it('Admin should be able to invite a LIBRARIAN', async () => {
      const result = await orgsService.inviteMember(testOrgId, adminUserId, {
        email: `desk_lib_${Date.now()}@test.edu`,
        proposedRole: 'LIBRARIAN',
        targetLibraryId: testLibraryId,
      });
      expect(result.invitationId).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it('Admin should NOT be able to invite an ADMIN (403 Forbidden)', async () => {
      await expect(
        orgsService.inviteMember(testOrgId, adminUserId, {
          email: `peer_admin_${Date.now()}@test.edu`,
          proposedRole: OrgRole.ADMIN,
        }),
      ).rejects.toThrow('Administrators cannot invite other Administrators or Owners');
    });

    it('Reader should NOT be able to invite anyone (403 Forbidden)', async () => {
      await expect(
        orgsService.inviteMember(testOrgId, readerUserId, {
          email: `anyone_${Date.now()}@test.edu`,
          proposedRole: 'LIBRARIAN',
        }),
      ).rejects.toThrow('Only Owners and Administrators can invite staff members');
    });
  });
});

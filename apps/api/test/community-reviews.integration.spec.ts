import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ConflictException, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
import { CommunityService } from '../src/modules/community/community.service';
import { OrgRole } from '@library/contracts';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

describe('Community, Reviews, Voting, Collections & Badges Integration Tests', () => {
  let controlPlaneDs: DataSource;
  let registryService: TenantDatabaseRegistryService;
  let connectionService: TenantConnectionService;
  let authService: AuthService;
  let orgsService: OrganizationsService;
  let catalogService: CatalogService;
  let circulationService: CirculationService;
  let auditService: AuditService;
  let communityService: CommunityService;
  let configService: ConfigService;

  let staffUserId: string;
  let readerAUserId: string;
  let readerBUserId: string;
  let readerCUserId: string;
  let testOrgId: string;
  let libraryId: string;
  let testBookId: string;
  let secondBookId: string;
  let copyBarcode: string;
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
    circulationService = new CirculationService(connectionService, undefined, auditService);
    communityService = new CommunityService(connectionService, auditService);

    // Setup Staff & Readers
    const staffReg = await authService.register({
      email: `comm-staff-${Date.now()}@library.test`,
      password: 'SecurePassword123!',
      displayName: 'Community Librarian',
    });
    staffUserId = staffReg.user.userId;

    const readerAReg = await authService.register({
      email: `reader-a-${Date.now()}@library.test`,
      password: 'SecurePassword123!',
      displayName: 'Alice Reader',
    });
    readerAUserId = readerAReg.user.userId;

    const readerBReg = await authService.register({
      email: `reader-b-${Date.now()}@library.test`,
      password: 'SecurePassword123!',
      displayName: 'Bob Reader',
    });
    readerBUserId = readerBReg.user.userId;

    const readerCReg = await authService.register({
      email: `reader-c-${Date.now()}@library.test`,
      password: 'SecurePassword123!',
      displayName: 'Charlie Reader',
    });
    readerCUserId = readerCReg.user.userId;

    // Create Organization & Provision Dedicated Tenant Database
    const orgSlug = `comm-test-${Date.now()}`;
    const orgResult = await orgsService.createOrganization(staffUserId, {
      name: 'Community Testing Organization',
      slug: orgSlug,
    });
    testOrgId = orgResult.organization.organizationId;

    const reg = await registryRepo.findOneBy({ organization_id: testOrgId });
    provisionedDbName = reg?.database_name || '';

    // Create First Library
    const lib = await orgsService.createLibrary(testOrgId, staffUserId, {
      name: 'Central Reading Room',
      slug: 'central-reading',
      timezone: 'Asia/Kolkata',
    });
    libraryId = lib.libraryId;

    // Seed Catalog Inventory
    await catalogService.seedLibrary(testOrgId, libraryId);

    // Get catalog works for tests
    const catalog = await catalogService.searchCatalog(testOrgId, libraryId, { limit: 10 });
    expect(catalog.items.length).toBeGreaterThanOrEqual(2);
    testBookId = catalog.items[0].bookId;
    secondBookId = catalog.items[1].bookId;

    // Save profile display names in tenant database
    const tenantDs = await connectionService.getTenantConnection(testOrgId);
    await tenantDs.query(
      `INSERT INTO "reader_profiles" ("user_id", "display_name")
       VALUES ($1, 'Alice Reader'), ($2, 'Bob Reader'), ($3, 'Charlie Reader')
       ON CONFLICT ("user_id") DO NOTHING`,
      [readerAUserId, readerBUserId, readerCUserId],
    );

    // Get a physical copy barcode for checkout eligibility testing
    const bookDetails = await catalogService.getBookDetails(testOrgId, libraryId, testBookId);
    copyBarcode = bookDetails.editions?.[0]?.copies?.[0]?.barcode || '';
    expect(copyBarcode).toBeTruthy();
  });

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
    } finally {
      if (controlPlaneDs.isInitialized) {
        await controlPlaneDs.destroy();
      }
    }
  });

  // ==========================================
  // 1. REVIEWS & ELIGIBILITY ENFORCEMENT
  // ==========================================

  describe('Review Policy & Eligibility Enforcement', () => {
    it('allows any member to review by default when requireBorrowHistory is false', async () => {
      const eligibility = await communityService.checkReviewEligibility(
        testOrgId,
        libraryId,
        readerAUserId,
        testBookId,
      );
      expect(eligibility.canReview).toBe(true);
      expect(eligibility.policy.requireBorrowHistory).toBe(false);
    });

    it('enforces requireBorrowHistory when enabled by branch policy', async () => {
      // Staff updates review policy to require borrowing history
      await communityService.updateReviewPolicy(testOrgId, libraryId, staffUserId, {
        requireBorrowHistory: true,
      });

      // Reader A has not borrowed this book yet -> eligibility should be false
      const beforeBorrow = await communityService.checkReviewEligibility(
        testOrgId,
        libraryId,
        readerAUserId,
        testBookId,
      );
      expect(beforeBorrow.canReview).toBe(false);
      expect(beforeBorrow.reason).toContain('borrowing history');

      // Attempting to create review directly should throw BadRequestException
      await expect(
        communityService.createReview(testOrgId, readerAUserId, {
          bookId: testBookId,
          libraryId,
          rating: 5,
          title: 'Premature Review',
          body: 'I have not read or borrowed this book yet.',
        }),
      ).rejects.toThrow(BadRequestException);

      // Reader A checks out a copy of the book
      await circulationService.checkout(testOrgId, libraryId, staffUserId, {
        barcode: copyBarcode,
        readerUserId: readerAUserId,
      });

      // Now Reader A has borrowing history -> eligibility is true!
      const afterBorrow = await communityService.checkReviewEligibility(
        testOrgId,
        libraryId,
        readerAUserId,
        testBookId,
      );
      expect(afterBorrow.canReview).toBe(true);

      // Now creating the review succeeds
      const review = await communityService.createReview(testOrgId, readerAUserId, {
        bookId: testBookId,
        libraryId,
        rating: 5,
        title: 'Masterpiece of Literature',
        body: 'A truly magnificent reading journey from start to finish.',
      });
      expect(review.reviewId).toBeDefined();
      expect(review.rating).toBe(5);
      expect(review.authorName).toBe('Alice Reader');
      expect(review.status).toBe('PUBLISHED');

      // Disallow duplicate review for the same book by the same reader
      await expect(
        communityService.createReview(testOrgId, readerAUserId, {
          bookId: testBookId,
          libraryId,
          rating: 4,
          title: 'Duplicate Review',
          body: 'Attempting to review twice.',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ==========================================
  // 2. ONE VOTE PER READER & CONCURRENCY
  // ==========================================

  describe('One Vote Per Reader, Vote Switching & Concurrency', () => {
    let reviewId: string;

    beforeAll(async () => {
      // Find the review created in previous test
      const reviews = await communityService.getReviewsForBook(testOrgId, testBookId);
      expect(reviews.length).toBeGreaterThanOrEqual(1);
      reviewId = reviews[0].reviewId;
    });

    it('enforces one vote per reader (upvote, switch to downvote, remove)', async () => {
      // Bob upvotes (+1)
      const vote1 = await communityService.voteReview(testOrgId, reviewId, readerBUserId, 1);
      expect(vote1.upvotesCount).toBe(1);
      expect(vote1.downvotesCount).toBe(0);
      expect(vote1.score).toBe(1);
      expect(vote1.userVote).toBe(1);

      // Bob upvotes again (+1) -> idempotent upsert
      const voteAgain = await communityService.voteReview(testOrgId, reviewId, readerBUserId, 1);
      expect(voteAgain.upvotesCount).toBe(1);
      expect(voteAgain.downvotesCount).toBe(0);
      expect(voteAgain.score).toBe(1);

      // Bob switches vote to downvote (-1)
      const voteDown = await communityService.voteReview(testOrgId, reviewId, readerBUserId, -1);
      expect(voteDown.upvotesCount).toBe(0);
      expect(voteDown.downvotesCount).toBe(1);
      expect(voteDown.score).toBe(-1);
      expect(voteDown.userVote).toBe(-1);

      // Bob removes his vote (0)
      const voteZero = await communityService.voteReview(testOrgId, reviewId, readerBUserId, 0);
      expect(voteZero.upvotesCount).toBe(0);
      expect(voteZero.downvotesCount).toBe(0);
      expect(voteZero.score).toBe(0);
      expect(voteZero.userVote).toBe(0);

      // Verify at the database level that exactly 0 rows remain for Bob
      const tenantDs = await connectionService.getTenantConnection(testOrgId);
      const rows = await tenantDs.query(
        `SELECT COUNT(*) as count FROM "review_votes" WHERE "review_id" = $1 AND "user_id" = $2`,
        [reviewId, readerBUserId],
      );
      expect(parseInt(rows[0].count, 10)).toBe(0);
    });

    it('maintains exact vote counts under concurrent requests', async () => {
      // Readers A, B, and C concurrently vote on the review
      // A upvotes (+1), B upvotes (+1), C downvotes (-1)
      await Promise.all([
        communityService.voteReview(testOrgId, reviewId, readerAUserId, 1),
        communityService.voteReview(testOrgId, reviewId, readerBUserId, 1),
        communityService.voteReview(testOrgId, reviewId, readerCUserId, -1),
      ]);

      const reviews = await communityService.getReviewsForBook(testOrgId, testBookId);
      const r = reviews.find((item) => item.reviewId === reviewId)!;
      expect(r.upvotesCount).toBe(2);
      expect(r.downvotesCount).toBe(1);
      expect(r.score).toBe(1); // 2 - 1 = 1

      // Concurrently switch votes:
      // A switches to downvote (-1), B removes (0), C switches to upvote (+1)
      await Promise.all([
        communityService.voteReview(testOrgId, reviewId, readerAUserId, -1),
        communityService.voteReview(testOrgId, reviewId, readerBUserId, 0),
        communityService.voteReview(testOrgId, reviewId, readerCUserId, 1),
      ]);

      const updatedReviews = await communityService.getReviewsForBook(testOrgId, testBookId);
      const updated = updatedReviews.find((item) => item.reviewId === reviewId)!;
      expect(updated.upvotesCount).toBe(1); // C
      expect(updated.downvotesCount).toBe(1); // A
      expect(updated.score).toBe(0); // 1 - 1 = 0
    });
  });

  // ==========================================
  // 3. MODERATION & VISIBILITY BOUNDARIES
  // ==========================================

  describe('Review Moderation & Visibility Boundaries', () => {
    let reviewId: string;

    beforeAll(async () => {
      const reviews = await communityService.getReviewsForBook(testOrgId, testBookId);
      reviewId = reviews[0].reviewId;
    });

    it('allows staff to moderate review to HIDDEN, hiding it from other readers', async () => {
      // Staff moderates review to HIDDEN
      const mod = await communityService.moderateReview(testOrgId, reviewId, staffUserId, {
        status: 'HIDDEN',
        reason: 'Under administrative review',
      });
      expect(mod.status).toBe('HIDDEN');

      // Staff querying reviews still sees it (with HIDDEN status)
      const staffView = await communityService.getReviewsForBook(
        testOrgId,
        testBookId,
        staffUserId,
        true,
      );
      expect(staffView.some((r) => r.reviewId === reviewId && r.status === 'HIDDEN')).toBe(true);

      // Reader B querying reviews does NOT see the HIDDEN review
      const readerBView = await communityService.getReviewsForBook(
        testOrgId,
        testBookId,
        readerBUserId,
        false,
      );
      expect(readerBView.some((r) => r.reviewId === reviewId)).toBe(false);

      // The author (Reader A) querying reviews DOES see their own review even if hidden
      const authorView = await communityService.getReviewsForBook(
        testOrgId,
        testBookId,
        readerAUserId,
        false,
      );
      expect(authorView.some((r) => r.reviewId === reviewId)).toBe(true);

      // Staff un-hides review back to PUBLISHED
      await communityService.moderateReview(testOrgId, reviewId, staffUserId, {
        status: 'PUBLISHED',
      });

      // Reader B can now see it again
      const readerBViewAfter = await communityService.getReviewsForBook(
        testOrgId,
        testBookId,
        readerBUserId,
        false,
      );
      expect(readerBViewAfter.some((r) => r.reviewId === reviewId)).toBe(true);
    });

    it('allows threaded comments and lists them with author display name', async () => {
      const comment = await communityService.createReviewComment(
        testOrgId,
        reviewId,
        readerBUserId,
        { body: 'I thoroughly agree with this review!' },
      );
      expect(comment.commentId).toBeDefined();
      expect(comment.authorName).toBe('Bob Reader');
      expect(comment.body).toBe('I thoroughly agree with this review!');

      const comments = await communityService.getReviewComments(testOrgId, reviewId);
      expect(comments.length).toBeGreaterThanOrEqual(1);
      expect(comments.some((c) => c.commentId === comment.commentId)).toBe(true);
    });
  });

  // ==========================================
  // 4. COLLECTIONS & ATOMIC REORDERING
  // ==========================================

  describe('Collections, Ownership & Atomic Book Reordering', () => {
    let collectionId: string;

    it('creates a collection and awards CURATOR badge for public collection', async () => {
      const coll = await communityService.createCollection(testOrgId, readerAUserId, {
        title: "Alice's Favorite Classics",
        description: 'A hand-picked selection of timeless masterpieces.',
        visibility: 'PUBLIC',
        initialBookIds: [testBookId, secondBookId],
      });

      expect(coll.collectionId).toBeDefined();
      expect(coll.title).toBe("Alice's Favorite Classics");
      expect(coll.visibility).toBe('PUBLIC');
      expect(coll.bookCount).toBe(2);
      expect(coll.books?.[0].position).toBe(1);
      expect(coll.books?.[1].position).toBe(2);
      collectionId = coll.collectionId;

      // Verify CURATOR badge was awarded to Reader A
      const badges = await communityService.getUserBadges(testOrgId, readerAUserId);
      expect(badges.some((b) => b.code === 'CURATOR')).toBe(true);
    });

    it('enforces ownership: other readers cannot edit, add books or reorder', async () => {
      // Reader B tries to reorder Reader A's collection -> Forbidden
      await expect(
        communityService.reorderCollectionBooks(
          testOrgId,
          collectionId,
          readerBUserId,
          false,
          [secondBookId, testBookId],
        ),
      ).rejects.toThrow(ForbiddenException);

      // Reader B tries to add a book -> Forbidden
      await expect(
        communityService.addBookToCollection(
          testOrgId,
          collectionId,
          readerBUserId,
          false,
          secondBookId,
        ),
      ).rejects.toThrow(ForbiddenException);

      // Reader B tries to update collection -> Forbidden
      await expect(
        communityService.updateCollection(
          testOrgId,
          collectionId,
          readerBUserId,
          false,
          { title: 'Hacked Title' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows creator to atomically reorder books in the collection', async () => {
      // Creator Reader A flips order: [secondBookId, testBookId]
      const reordered = await communityService.reorderCollectionBooks(
        testOrgId,
        collectionId,
        readerAUserId,
        false,
        [secondBookId, testBookId],
      );

      expect(reordered.books?.[0].bookId).toBe(secondBookId);
      expect(reordered.books?.[0].position).toBe(1);
      expect(reordered.books?.[1].bookId).toBe(testBookId);
      expect(reordered.books?.[1].position).toBe(2);

      // Verify in database that unique (collection_id, position) holds
      const tenantDs = await connectionService.getTenantConnection(testOrgId);
      const rows = await tenantDs.query(
        `SELECT "book_id", "position" FROM "collection_books" WHERE "collection_id" = $1 ORDER BY "position" ASC`,
        [collectionId],
      );
      expect(rows[0].book_id).toBe(secondBookId);
      expect(rows[0].position).toBe(1);
      expect(rows[1].book_id).toBe(testBookId);
      expect(rows[1].position).toBe(2);
    });

    it('allows staff moderation on collections', async () => {
      // Staff updates visibility to UNLISTED
      const moderated = await communityService.updateCollection(
        testOrgId,
        collectionId,
        staffUserId,
        true,
        { visibility: 'UNLISTED' },
      );
      expect(moderated.visibility).toBe('UNLISTED');
    });
  });

  // ==========================================
  // 5. BADGES & READER BADGES
  // ==========================================

  describe('Badges System & Reader Badges', () => {
    it('seeds and returns default badges catalog', async () => {
      const badges = await communityService.getBadges(testOrgId);
      expect(badges.length).toBeGreaterThanOrEqual(4);
      expect(badges.some((b) => b.code === 'FIRST_BORROW')).toBe(true);
      expect(badges.some((b) => b.code === 'AVID_READER')).toBe(true);
      expect(badges.some((b) => b.code === 'TOP_CRITIC')).toBe(true);
      expect(badges.some((b) => b.code === 'CURATOR')).toBe(true);
    });

    it('allows staff to award a badge to a reader', async () => {
      const awarded = await communityService.awardBadge(
        testOrgId,
        readerBUserId,
        'AVID_READER',
        staffUserId,
      );
      expect(awarded.code).toBe('AVID_READER');
      expect(awarded.userId).toBe(readerBUserId);

      const userBadges = await communityService.getUserBadges(testOrgId, readerBUserId);
      expect(userBadges.some((b) => b.code === 'AVID_READER')).toBe(true);
    });
  });

  // ==========================================
  // 6. SHARE DEEP LINKS
  // ==========================================

  describe('Share Deep Links with Access Control', () => {
    let privateCollectionId: string;
    let publicCollectionId: string;
    let reviewId: string;

    beforeAll(async () => {
      // Create a private collection for Reader A
      const priv = await communityService.createCollection(testOrgId, readerAUserId, {
        title: "Alice's Secret Reading List",
        visibility: 'PRIVATE',
        initialBookIds: [testBookId],
      });
      privateCollectionId = priv.collectionId;

      // Create a public collection for Reader A
      const pub = await communityService.createCollection(testOrgId, readerAUserId, {
        title: "Alice's Public Shelf",
        visibility: 'PUBLIC',
        initialBookIds: [secondBookId],
      });
      publicCollectionId = pub.collectionId;

      const reviews = await communityService.getReviewsForBook(testOrgId, testBookId);
      reviewId = reviews[0].reviewId;
    });

    it('validates collection deep link visibility', async () => {
      // Public collection deep link is accessible to anyone
      const sharedPublic = await communityService.getDeepLinkCollection(
        testOrgId,
        publicCollectionId,
        readerBUserId,
        false,
      );
      expect(sharedPublic.collection.title).toBe("Alice's Public Shelf");
      expect(sharedPublic.accessLevel).toBe('PUBLIC');
      expect(sharedPublic.isOwner).toBe(false);

      // Private collection deep link is accessible to owner Reader A
      const ownerAccess = await communityService.getDeepLinkCollection(
        testOrgId,
        privateCollectionId,
        readerAUserId,
        false,
      );
      expect(ownerAccess.isOwner).toBe(true);
      expect(ownerAccess.accessLevel).toBe('OWNER');

      // Private collection deep link is accessible to staff
      const staffAccess = await communityService.getDeepLinkCollection(
        testOrgId,
        privateCollectionId,
        staffUserId,
        true,
      );
      expect(staffAccess.collection.title).toBe("Alice's Secret Reading List");

      // Private collection deep link throws ForbiddenException for Reader B
      await expect(
        communityService.getDeepLinkCollection(
          testOrgId,
          privateCollectionId,
          readerBUserId,
          false,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('validates review deep link status', async () => {
      // Public review deep link is accessible to Reader B
      const sharedReview = await communityService.getDeepLinkReview(
        testOrgId,
        reviewId,
        readerBUserId,
        false,
      );
      expect(sharedReview.review.reviewId).toBe(reviewId);
      expect(sharedReview.accessLevel).toBe('PUBLIC');

      // Staff hides review
      await communityService.moderateReview(testOrgId, reviewId, staffUserId, {
        status: 'HIDDEN',
      });

      // Hidden review deep link is accessible to author Reader A
      const authorAccess = await communityService.getDeepLinkReview(
        testOrgId,
        reviewId,
        readerAUserId,
        false,
      );
      expect(authorAccess.accessLevel).toBe('AUTHOR_OR_STAFF');

      // Hidden review deep link is accessible to staff
      const staffAccess = await communityService.getDeepLinkReview(
        testOrgId,
        reviewId,
        staffUserId,
        true,
      );
      expect(staffAccess.accessLevel).toBe('AUTHOR_OR_STAFF');

      // Hidden review deep link throws ForbiddenException for Reader B
      await expect(
        communityService.getDeepLinkReview(
          testOrgId,
          reviewId,
          readerBUserId,
          false,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

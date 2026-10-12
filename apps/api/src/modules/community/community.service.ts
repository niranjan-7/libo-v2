import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TenantConnectionService } from '../tenant-connection/tenant-connection.service';
import { AuditService } from '../audit/audit.service';
import {
  ReviewDto,
  ReviewStatus,
  ReviewCommentDto,
  ReviewPolicyConfigDto,
  ReviewEligibilityDto,
  CollectionDto,
  CollectionBookItemDto,
  CollectionVisibility,
  CollectionStatus,
  BadgeDto,
  ReaderBadgeDto,
  SharedCollectionResponse,
  SharedReviewResponse,
} from '@library/contracts';
import {
  CreateReviewDto,
  CreateReviewCommentDto,
  ModerateReviewDto,
  UpdateReviewPolicyDto,
  CreateCollectionDto,
  UpdateCollectionDto,
} from './dto/community.dto';

const DEFAULT_REVIEW_POLICY: ReviewPolicyConfigDto = {
  requireBorrowHistory: false,
  minAccountAgeDays: 0,
};

const DEFAULT_BADGES = [
  {
    code: 'FIRST_BORROW',
    name: 'Book Explorer',
    description: 'Borrowed your first book from the library catalog.',
    criteria: { action: 'BORROW', count: 1 },
  },
  {
    code: 'AVID_READER',
    name: 'Voracious Reader',
    description: 'Completed 5 or more successful book loans.',
    criteria: { action: 'BORROW', count: 5 },
  },
  {
    code: 'TOP_CRITIC',
    name: 'Insightful Reviewer',
    description: 'Authored 3 or more helpful community reviews.',
    criteria: { action: 'REVIEW', count: 3 },
  },
  {
    code: 'CURATOR',
    name: 'Master Curator',
    description: 'Published a curated book collection for the library community.',
    criteria: { action: 'COLLECTION', count: 1 },
  },
];

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    private readonly tenantConnectionService: TenantConnectionService,
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
   * Automatically seed system badges into tenant database if not yet present
   */
  async ensureDefaultBadges(em: EntityManager): Promise<void> {
    for (const b of DEFAULT_BADGES) {
      await em.query(
        `INSERT INTO "badges" ("code", "name", "description", "criteria")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("code") DO NOTHING`,
        [b.code, b.name, b.description, JSON.stringify(b.criteria)],
      );
    }
  }

  // ==========================================
  // 1. REVIEW POLICY & ELIGIBILITY
  // ==========================================

  async getReviewPolicy(
    organizationId: string,
    libraryId?: string,
  ): Promise<ReviewPolicyConfigDto> {
    if (!libraryId) return DEFAULT_REVIEW_POLICY;
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const rows = await tenantDs.query(
      `SELECT "value" FROM "library_settings" WHERE "library_id" = $1 AND "setting_key" = 'review_policy'`,
      [libraryId],
    );

    if (!rows || rows.length === 0) return DEFAULT_REVIEW_POLICY;
    const val = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
    return {
      requireBorrowHistory: val.requireBorrowHistory ?? DEFAULT_REVIEW_POLICY.requireBorrowHistory,
      minAccountAgeDays: val.minAccountAgeDays ?? DEFAULT_REVIEW_POLICY.minAccountAgeDays,
    };
  }

  async updateReviewPolicy(
    organizationId: string,
    libraryId: string,
    staffUserId: string,
    dto: UpdateReviewPolicyDto,
  ): Promise<ReviewPolicyConfigDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const current = await this.getReviewPolicy(organizationId, libraryId);
    const updated: ReviewPolicyConfigDto = {
      requireBorrowHistory: dto.requireBorrowHistory ?? current.requireBorrowHistory,
      minAccountAgeDays: dto.minAccountAgeDays ?? current.minAccountAgeDays,
    };

    await tenantDs.query(
      `INSERT INTO "library_settings" ("library_id", "setting_key", "value", "updated_by_user_id", "updated_at")
       VALUES ($1, 'review_policy', $2, $3, NOW())
       ON CONFLICT ("library_id", "setting_key")
       DO UPDATE SET "value" = EXCLUDED."value", "updated_by_user_id" = EXCLUDED."updated_by_user_id", "updated_at" = NOW()`,
      [libraryId, JSON.stringify(updated), staffUserId],
    );

    if (this.auditService) {
      await this.auditService.log(organizationId, {
        libraryId,
        actorUserId: staffUserId,
        action: 'UPDATE_REVIEW_POLICY',
        entityType: 'LIBRARY_SETTINGS',
        entityId: libraryId,
        newValue: updated,
      });
    }

    return updated;
  }

  async checkReviewEligibility(
    organizationId: string,
    libraryId: string | undefined,
    userId: string,
    bookId: string,
  ): Promise<ReviewEligibilityDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    const policy = await this.getReviewPolicy(organizationId, libraryId);

    // 1. Check if user already reviewed this book
    const existing = await tenantDs.query(
      `SELECT "review_id" FROM "reviews" WHERE "user_id" = $1 AND "book_id" = $2 LIMIT 1`,
      [userId, bookId],
    );
    if (existing.length > 0) {
      return {
        canReview: false,
        reason: 'You have already reviewed this book',
        policy,
      };
    }

    // 2. Check if borrow history is required by library policy
    if (policy.requireBorrowHistory) {
      const borrowCheck = await tenantDs.query(
        `SELECT 1 FROM "loans" l
         JOIN "book_copies" bc ON bc.copy_id = l.copy_id
         JOIN "book_editions" be ON be.edition_id = bc.edition_id
         WHERE l.reader_user_id = $1 AND be.book_id = $2
         LIMIT 1`,
        [userId, bookId],
      );
      if (borrowCheck.length === 0) {
        return {
          canReview: false,
          reason: 'Review policy requires borrowing history for this title before reviewing',
          policy,
        };
      }
    }

    // 3. Check min account age if configured
    if (policy.minAccountAgeDays > 0) {
      const member = await tenantDs.query(
        `SELECT "joined_at" FROM "library_memberships" WHERE "user_id" = $1 ORDER BY "joined_at" ASC LIMIT 1`,
        [userId],
      );
      if (member.length > 0) {
        const joinedDate = new Date(member[0].joined_at).getTime();
        const daysOld = (Date.now() - joinedDate) / (1000 * 60 * 60 * 24);
        if (daysOld < policy.minAccountAgeDays) {
          return {
            canReview: false,
            reason: `Account must be at least ${policy.minAccountAgeDays} days old to review`,
            policy,
          };
        }
      }
    }

    return {
      canReview: true,
      policy,
    };
  }

  // ==========================================
  // 2. REVIEWS & VOTES
  // ==========================================

  async createReview(
    organizationId: string,
    userId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    // Check eligibility
    const eligibility = await this.checkReviewEligibility(
      organizationId,
      dto.libraryId,
      userId,
      dto.bookId,
    );
    if (!eligibility.canReview) {
      if (eligibility.reason?.includes('already reviewed')) {
        throw new ConflictException(eligibility.reason);
      }
      throw new BadRequestException(eligibility.reason || 'Not eligible to write a review');
    }

    // Check book exists
    const bookRows = await tenantDs.query(
      `SELECT "title" FROM "books" WHERE "book_id" = $1`,
      [dto.bookId],
    );
    if (bookRows.length === 0) {
      throw new NotFoundException(`Book not found: ${dto.bookId}`);
    }
    const bookTitle = bookRows[0].title;

    try {
      const res = await tenantDs.query(
        `INSERT INTO "reviews" ("user_id", "book_id", "rating", "title", "body", "status", "created_at", "updated_at")
         VALUES ($1, $2, $3, $4, $5, 'PUBLISHED', NOW(), NOW())
         RETURNING *`,
        [userId, dto.bookId, dto.rating, dto.title.trim(), dto.body.trim()],
      );

      const created = this.extractRow<any>(res);

      // Audit log
      if (this.auditService) {
        await this.auditService.log(organizationId, {
          libraryId: dto.libraryId,
          actorUserId: userId,
          action: 'CREATE_REVIEW',
          entityType: 'REVIEW',
          entityId: created.review_id,
          newValue: { bookId: dto.bookId, rating: dto.rating, title: dto.title },
        });
      }

      // Check badge trigger: Award TOP_CRITIC if user has 3+ published reviews
      const countRes = await tenantDs.query(
        `SELECT COUNT(*) as count FROM "reviews" WHERE "user_id" = $1 AND "status" = 'PUBLISHED'`,
        [userId],
      );
      if (parseInt(countRes[0]?.count || '0', 10) >= 3) {
        await this.awardBadge(organizationId, userId, 'TOP_CRITIC', userId);
      }

      // Resolve author display name
      const profileRes = await tenantDs.query(
        `SELECT "display_name" FROM "reader_profiles" WHERE "user_id" = $1 LIMIT 1`,
        [userId],
      );
      const authorName = profileRes[0]?.display_name || 'Reader';

      return {
        reviewId: created.review_id,
        bookId: created.book_id,
        bookTitle,
        userId: created.user_id,
        authorName,
        rating: created.rating,
        title: created.title,
        body: created.body,
        status: created.status as ReviewStatus,
        createdAt: new Date(created.created_at).toISOString(),
        updatedAt: new Date(created.updated_at).toISOString(),
        upvotesCount: 0,
        downvotesCount: 0,
        score: 0,
        userVote: 0,
        commentsCount: 0,
      };
    } catch (err: any) {
      if (err.code === '23505') {
        throw new ConflictException('You have already reviewed this book');
      }
      throw err;
    }
  }

  async getReviewsForBook(
    organizationId: string,
    bookId: string,
    requestingUserId?: string,
    isStaff = false,
  ): Promise<ReviewDto[]> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const query = `
      SELECT
        r.review_id,
        r.book_id,
        b.title as "bookTitle",
        r.user_id,
        COALESCE(rp.display_name, 'Reader') as "authorName",
        r.rating,
        r.title,
        r.body,
        r.status,
        r.created_at,
        r.updated_at,
        COALESCE(v.upvotes, 0)::int as "upvotesCount",
        COALESCE(v.downvotes, 0)::int as "downvotesCount",
        COALESCE(v.score, 0)::int as "score",
        uv.vote_value as "userVote",
        COALESCE(c.comments_count, 0)::int as "commentsCount"
      FROM "reviews" r
      JOIN "books" b ON b.book_id = r.book_id
      LEFT JOIN "reader_profiles" rp ON rp.user_id = r.user_id
      LEFT JOIN (
        SELECT
          review_id,
          COUNT(*) FILTER (WHERE vote_value = 1) as upvotes,
          COUNT(*) FILTER (WHERE vote_value = -1) as downvotes,
          SUM(vote_value) as score
        FROM "review_votes"
        GROUP BY review_id
      ) v ON v.review_id = r.review_id
      LEFT JOIN "review_votes" uv ON uv.review_id = r.review_id AND uv.user_id = $2
      LEFT JOIN (
        SELECT review_id, COUNT(*) as comments_count
        FROM "review_comments"
        GROUP BY review_id
      ) c ON c.review_id = r.review_id
      WHERE r.book_id = $1
        AND (r.status = 'PUBLISHED' OR r.user_id = $2 OR $3 = true)
      ORDER BY r.created_at DESC
    `;

    const rows = await tenantDs.query(query, [bookId, requestingUserId || '00000000-0000-0000-0000-000000000000', isStaff]);

    return rows.map((r: any) => ({
      reviewId: r.review_id,
      bookId: r.book_id,
      bookTitle: r.bookTitle,
      userId: r.user_id,
      authorName: r.authorName,
      rating: r.rating,
      title: r.title,
      body: r.body,
      status: r.status as ReviewStatus,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
      upvotesCount: parseInt(r.upvotesCount || '0', 10),
      downvotesCount: parseInt(r.downvotesCount || '0', 10),
      score: parseInt(r.score || '0', 10),
      userVote: r.userVote !== null && r.userVote !== undefined ? parseInt(r.userVote, 10) : 0,
      commentsCount: parseInt(r.commentsCount || '0', 10),
    }));
  }

  /**
   * Vote on a review atomically.
   * Concurrency guarantee: review_votes table PRIMARY KEY (review_id, user_id)
   * ensures exactly one vote per reader per review. An atomic UPSERT updates
   * or switches the vote, and a vote value of 0 deletes it cleanly.
   */
  async voteReview(
    organizationId: string,
    reviewId: string,
    userId: string,
    vote: 1 | -1 | 0,
  ): Promise<{ upvotesCount: number; downvotesCount: number; score: number; userVote: number }> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    // Verify review exists
    const reviewCheck = await tenantDs.query(
      `SELECT "review_id" FROM "reviews" WHERE "review_id" = $1`,
      [reviewId],
    );
    if (reviewCheck.length === 0) {
      throw new NotFoundException(`Review not found: ${reviewId}`);
    }

    if (vote === 1 || vote === -1) {
      await tenantDs.query(
        `INSERT INTO "review_votes" ("review_id", "user_id", "vote_value", "created_at")
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT ("review_id", "user_id")
         DO UPDATE SET "vote_value" = EXCLUDED.vote_value`,
        [reviewId, userId, vote],
      );
    } else {
      // vote === 0: remove vote
      await tenantDs.query(
        `DELETE FROM "review_votes" WHERE "review_id" = $1 AND "user_id" = $2`,
        [reviewId, userId],
      );
    }

    // Atomic query of updated counts
    const countRes = await tenantDs.query(
      `SELECT
         COUNT(*) FILTER (WHERE vote_value = 1)::int AS upvotes,
         COUNT(*) FILTER (WHERE vote_value = -1)::int AS downvotes,
         COALESCE(SUM(vote_value), 0)::int AS score,
         (SELECT vote_value FROM "review_votes" WHERE "review_id" = $1 AND "user_id" = $2) AS "userVote"
       FROM "review_votes"
       WHERE "review_id" = $1`,
      [reviewId, userId],
    );

    const row = countRes[0] || {};
    return {
      upvotesCount: parseInt(row.upvotes || '0', 10),
      downvotesCount: parseInt(row.downvotes || '0', 10),
      score: parseInt(row.score || '0', 10),
      userVote: row.userVote !== null && row.userVote !== undefined ? parseInt(row.userVote, 10) : 0,
    };
  }

  async moderateReview(
    organizationId: string,
    reviewId: string,
    staffUserId: string,
    dto: ModerateReviewDto,
  ): Promise<ReviewDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const check = await tenantDs.query(
      `SELECT * FROM "reviews" WHERE "review_id" = $1`,
      [reviewId],
    );
    if (check.length === 0) {
      throw new NotFoundException(`Review not found: ${reviewId}`);
    }

    const res = await tenantDs.query(
      `UPDATE "reviews" SET "status" = $1, "updated_at" = NOW() WHERE "review_id" = $2 RETURNING *`,
      [dto.status, reviewId],
    );
    const updated = this.extractRow<any>(res);

    if (this.auditService) {
      await this.auditService.log(organizationId, {
        actorUserId: staffUserId,
        action: 'MODERATE_REVIEW',
        entityType: 'REVIEW',
        entityId: reviewId,
        oldValue: { status: check[0].status },
        newValue: { status: dto.status, reason: dto.reason },
      });
    }

    const reviews = await this.getReviewsForBook(organizationId, updated.book_id, staffUserId, true);
    const matching = reviews.find((r) => r.reviewId === reviewId);
    if (!matching) {
      throw new NotFoundException('Updated review not found');
    }
    return matching;
  }

  // ==========================================
  // 3. REVIEW COMMENTS
  // ==========================================

  async createReviewComment(
    organizationId: string,
    reviewId: string,
    userId: string,
    dto: CreateReviewCommentDto,
  ): Promise<ReviewCommentDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const reviewCheck = await tenantDs.query(
      `SELECT "review_id", "status" FROM "reviews" WHERE "review_id" = $1`,
      [reviewId],
    );
    if (reviewCheck.length === 0) {
      throw new NotFoundException(`Review not found: ${reviewId}`);
    }
    if (reviewCheck[0].status === 'HIDDEN') {
      throw new ForbiddenException('Cannot comment on a hidden review');
    }

    const res = await tenantDs.query(
      `INSERT INTO "review_comments" ("review_id", "user_id", "body", "created_at")
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [reviewId, userId, dto.body.trim()],
    );
    const created = this.extractRow<any>(res);

    if (this.auditService) {
      await this.auditService.log(organizationId, {
        actorUserId: userId,
        action: 'CREATE_REVIEW_COMMENT',
        entityType: 'REVIEW_COMMENT',
        entityId: created.comment_id,
        newValue: { reviewId },
      });
    }

    const profileRes = await tenantDs.query(
      `SELECT "display_name" FROM "reader_profiles" WHERE "user_id" = $1 LIMIT 1`,
      [userId],
    );
    const authorName = profileRes[0]?.display_name || 'Reader';

    return {
      commentId: created.comment_id,
      reviewId: created.review_id,
      userId: created.user_id,
      authorName,
      body: created.body,
      createdAt: new Date(created.created_at).toISOString(),
    };
  }

  async getReviewComments(
    organizationId: string,
    reviewId: string,
  ): Promise<ReviewCommentDto[]> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const rows = await tenantDs.query(
      `SELECT
         rc.comment_id,
         rc.review_id,
         rc.user_id,
         COALESCE(rp.display_name, 'Reader') as "authorName",
         rc.body,
         rc.created_at
       FROM "review_comments" rc
       LEFT JOIN "reader_profiles" rp ON rp.user_id = rc.user_id
       WHERE rc.review_id = $1
       ORDER BY rc.created_at ASC`,
      [reviewId],
    );

    return rows.map((r: any) => ({
      commentId: r.comment_id,
      reviewId: r.review_id,
      userId: r.user_id,
      authorName: r.authorName,
      body: r.body,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  }

  // ==========================================
  // 4. COLLECTIONS & ORDERING
  // ==========================================

  async createCollection(
    organizationId: string,
    userId: string,
    dto: CreateCollectionDto,
  ): Promise<CollectionDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    await this.ensureDefaultBadges(tenantDs.manager);

    const visibility = dto.visibility || 'PUBLIC';

    const res = await tenantDs.query(
      `INSERT INTO "collections" ("creator_user_id", "title", "description", "visibility", "status", "created_at")
       VALUES ($1, $2, $3, $4, 'ACTIVE', NOW())
       RETURNING *`,
      [userId, dto.title.trim(), dto.description?.trim() || null, visibility],
    );
    const created = this.extractRow<any>(res);

    if (dto.initialBookIds && dto.initialBookIds.length > 0) {
      for (let i = 0; i < dto.initialBookIds.length; i++) {
        await tenantDs.query(
          `INSERT INTO "collection_books" ("collection_id", "book_id", "position")
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [created.collection_id, dto.initialBookIds[i], i + 1],
        );
      }
    }

    if (this.auditService) {
      await this.auditService.log(organizationId, {
        actorUserId: userId,
        action: 'CREATE_COLLECTION',
        entityType: 'COLLECTION',
        entityId: created.collection_id,
        newValue: { title: dto.title, visibility },
      });
    }

    if (visibility === 'PUBLIC') {
      await this.awardBadge(organizationId, userId, 'CURATOR', userId);
    }

    return this.getCollectionDetails(organizationId, created.collection_id, userId, false);
  }

  async getCollections(
    organizationId: string,
    requestingUserId?: string,
    isStaff = false,
  ): Promise<CollectionDto[]> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const query = `
      SELECT
        c.collection_id,
        c.creator_user_id,
        COALESCE(rp.display_name, 'Curator') as "creatorName",
        c.title,
        c.description,
        c.visibility,
        c.status,
        c.created_at,
        (SELECT COUNT(*) FROM "collection_books" WHERE collection_id = c.collection_id)::int as "bookCount"
      FROM "collections" c
      LEFT JOIN "reader_profiles" rp ON rp.user_id = c.creator_user_id
      WHERE c.status = 'ACTIVE'
        AND (c.visibility = 'PUBLIC' OR c.creator_user_id = $1 OR $2 = true)
      ORDER BY c.created_at DESC
    `;

    const rows = await tenantDs.query(query, [
      requestingUserId || '00000000-0000-0000-0000-000000000000',
      isStaff,
    ]);

    return rows.map((r: any) => ({
      collectionId: r.collection_id,
      creatorUserId: r.creator_user_id,
      creatorName: r.creatorName,
      title: r.title,
      description: r.description,
      visibility: r.visibility as CollectionVisibility,
      status: r.status as CollectionStatus,
      createdAt: new Date(r.created_at).toISOString(),
      bookCount: parseInt(r.bookCount || '0', 10),
    }));
  }

  async getCollectionDetails(
    organizationId: string,
    collectionId: string,
    requestingUserId?: string,
    isStaff = false,
  ): Promise<CollectionDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const collRows = await tenantDs.query(
      `SELECT
         c.collection_id,
         c.creator_user_id,
         COALESCE(rp.display_name, 'Curator') as "creatorName",
         c.title,
         c.description,
         c.visibility,
         c.status,
         c.created_at
       FROM "collections" c
       LEFT JOIN "reader_profiles" rp ON rp.user_id = c.creator_user_id
       WHERE c.collection_id = $1`,
      [collectionId],
    );

    if (collRows.length === 0) {
      throw new NotFoundException(`Collection not found: ${collectionId}`);
    }

    const coll = collRows[0];

    // Visibility access control
    if (coll.visibility === 'PRIVATE' && coll.creator_user_id !== requestingUserId && !isStaff) {
      throw new ForbiddenException('Private collection cannot be accessed');
    }
    if (coll.status === 'ARCHIVED' && !isStaff) {
      throw new NotFoundException('Collection is archived');
    }

    // Fetch ordered books
    const bookRows = await tenantDs.query(
      `SELECT
         cb.position,
         b.book_id,
         b.title,
         b.subtitle,
         b.cover_url,
         (
           SELECT COALESCE(COUNT(bc.copy_id), 0)::int
           FROM "book_copies" bc
           JOIN "book_editions" be ON be.edition_id = bc.edition_id
           WHERE be.book_id = b.book_id AND bc.status = 'AVAILABLE'
         ) as "availableCopies",
         (
           SELECT COALESCE(COUNT(bc.copy_id), 0)::int
           FROM "book_copies" bc
           JOIN "book_editions" be ON be.edition_id = bc.edition_id
           WHERE be.book_id = b.book_id
         ) as "totalCopies"
       FROM "collection_books" cb
       JOIN "books" b ON b.book_id = cb.book_id
       WHERE cb.collection_id = $1
       ORDER BY cb.position ASC`,
      [collectionId],
    );

    const books: CollectionBookItemDto[] = [];
    for (const b of bookRows) {
      const authors = await tenantDs.query(
        `SELECT a.author_id, a.name
         FROM "authors" a
         JOIN "book_authors" ba ON ba.author_id = a.author_id
         WHERE ba.book_id = $1`,
        [b.book_id],
      );

      books.push({
        collectionId,
        bookId: b.book_id,
        position: b.position,
        title: b.title,
        subtitle: b.subtitle || undefined,
        coverUrl: b.cover_url || undefined,
        authors: authors.map((a: any) => ({ authorId: a.author_id, name: a.name })),
        availableCopies: parseInt(b.availableCopies || '0', 10),
        totalCopies: parseInt(b.totalCopies || '0', 10),
      });
    }

    return {
      collectionId: coll.collection_id,
      creatorUserId: coll.creator_user_id,
      creatorName: coll.creatorName,
      title: coll.title,
      description: coll.description,
      visibility: coll.visibility as CollectionVisibility,
      status: coll.status as CollectionStatus,
      createdAt: new Date(coll.created_at).toISOString(),
      bookCount: books.length,
      books,
    };
  }

  async updateCollection(
    organizationId: string,
    collectionId: string,
    userId: string,
    isStaff: boolean,
    dto: UpdateCollectionDto,
  ): Promise<CollectionDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const collRows = await tenantDs.query(
      `SELECT * FROM "collections" WHERE "collection_id" = $1`,
      [collectionId],
    );
    if (collRows.length === 0) {
      throw new NotFoundException(`Collection not found: ${collectionId}`);
    }
    const coll = collRows[0];

    // Enforce collection ownership or staff moderation
    if (coll.creator_user_id !== userId && !isStaff) {
      throw new ForbiddenException('You do not have permission to modify this collection');
    }

    const newTitle = dto.title !== undefined ? dto.title.trim() : coll.title;
    const newDesc = dto.description !== undefined ? dto.description.trim() : coll.description;
    const newVisibility = dto.visibility || coll.visibility;
    const newStatus = dto.status || coll.status;

    await tenantDs.query(
      `UPDATE "collections"
       SET "title" = $1, "description" = $2, "visibility" = $3, "status" = $4
       WHERE "collection_id" = $5`,
      [newTitle, newDesc, newVisibility, newStatus, collectionId],
    );

    if (this.auditService) {
      await this.auditService.log(organizationId, {
        actorUserId: userId,
        action: 'UPDATE_COLLECTION',
        entityType: 'COLLECTION',
        entityId: collectionId,
        newValue: { title: newTitle, visibility: newVisibility, status: newStatus },
      });
    }

    return this.getCollectionDetails(organizationId, collectionId, userId, isStaff);
  }

  async addBookToCollection(
    organizationId: string,
    collectionId: string,
    userId: string,
    isStaff: boolean,
    bookId: string,
  ): Promise<CollectionDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const collRows = await tenantDs.query(
      `SELECT * FROM "collections" WHERE "collection_id" = $1`,
      [collectionId],
    );
    if (collRows.length === 0) {
      throw new NotFoundException(`Collection not found: ${collectionId}`);
    }
    const coll = collRows[0];

    if (coll.creator_user_id !== userId && !isStaff) {
      throw new ForbiddenException('You do not have permission to modify this collection');
    }

    // Verify book exists
    const bookCheck = await tenantDs.query(
      `SELECT "book_id" FROM "books" WHERE "book_id" = $1`,
      [bookId],
    );
    if (bookCheck.length === 0) {
      throw new NotFoundException(`Book not found: ${bookId}`);
    }

    // Atomic position calculation: next available position
    const posRes = await tenantDs.query(
      `SELECT COALESCE(MAX(position), 0) + 1 AS "nextPos" FROM "collection_books" WHERE "collection_id" = $1`,
      [collectionId],
    );
    const nextPos = parseInt(posRes[0].nextPos, 10);

    await tenantDs.query(
      `INSERT INTO "collection_books" ("collection_id", "book_id", "position")
       VALUES ($1, $2, $3)
       ON CONFLICT ("collection_id", "book_id") DO NOTHING`,
      [collectionId, bookId, nextPos],
    );

    return this.getCollectionDetails(organizationId, collectionId, userId, isStaff);
  }

  async removeBookFromCollection(
    organizationId: string,
    collectionId: string,
    userId: string,
    isStaff: boolean,
    bookId: string,
  ): Promise<CollectionDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const collRows = await tenantDs.query(
      `SELECT * FROM "collections" WHERE "collection_id" = $1`,
      [collectionId],
    );
    if (collRows.length === 0) {
      throw new NotFoundException(`Collection not found: ${collectionId}`);
    }
    const coll = collRows[0];

    if (coll.creator_user_id !== userId && !isStaff) {
      throw new ForbiddenException('You do not have permission to modify this collection');
    }

    await tenantDs.transaction(async (tx) => {
      await tx.query(
        `DELETE FROM "collection_books" WHERE "collection_id" = $1 AND "book_id" = $2`,
        [collectionId, bookId],
      );

      // Re-pack remaining books sequentially
      const remaining = await tx.query(
        `SELECT "book_id" FROM "collection_books" WHERE "collection_id" = $1 ORDER BY "position" ASC`,
        [collectionId],
      );

      for (let i = 0; i < remaining.length; i++) {
        await tx.query(
          `UPDATE "collection_books" SET "position" = $1 WHERE "collection_id" = $2 AND "book_id" = $3`,
          [i + 1, collectionId, remaining[i].book_id],
        );
      }
    });

    return this.getCollectionDetails(organizationId, collectionId, userId, isStaff);
  }

  /**
   * Atomically reorder books in collection.
   * Takes an ordered array of bookIds and updates their sequence in a transaction.
   */
  async reorderCollectionBooks(
    organizationId: string,
    collectionId: string,
    userId: string,
    isStaff: boolean,
    bookIds: string[],
  ): Promise<CollectionDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const collRows = await tenantDs.query(
      `SELECT * FROM "collections" WHERE "collection_id" = $1`,
      [collectionId],
    );
    if (collRows.length === 0) {
      throw new NotFoundException(`Collection not found: ${collectionId}`);
    }
    const coll = collRows[0];

    if (coll.creator_user_id !== userId && !isStaff) {
      throw new ForbiddenException('You do not have permission to modify this collection');
    }

    await tenantDs.transaction(async (tx) => {
      // Remove current positions to avoid collision with unique (collection_id, position)
      await tx.query(
        `DELETE FROM "collection_books" WHERE "collection_id" = $1`,
        [collectionId],
      );

      // Re-insert books in the new target order
      for (let i = 0; i < bookIds.length; i++) {
        await tx.query(
          `INSERT INTO "collection_books" ("collection_id", "book_id", "position")
           VALUES ($1, $2, $3)`,
          [collectionId, bookIds[i], i + 1],
        );
      }
    });

    if (this.auditService) {
      await this.auditService.log(organizationId, {
        actorUserId: userId,
        action: 'REORDER_COLLECTION_BOOKS',
        entityType: 'COLLECTION',
        entityId: collectionId,
        newValue: { orderedBookIds: bookIds },
      });
    }

    return this.getCollectionDetails(organizationId, collectionId, userId, isStaff);
  }

  async deleteCollection(
    organizationId: string,
    collectionId: string,
    userId: string,
    isStaff: boolean,
  ): Promise<void> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const collRows = await tenantDs.query(
      `SELECT * FROM "collections" WHERE "collection_id" = $1`,
      [collectionId],
    );
    if (collRows.length === 0) {
      throw new NotFoundException(`Collection not found: ${collectionId}`);
    }
    const coll = collRows[0];

    if (coll.creator_user_id !== userId && !isStaff) {
      throw new ForbiddenException('You do not have permission to delete this collection');
    }

    await tenantDs.query(
      `UPDATE "collections" SET "status" = 'ARCHIVED' WHERE "collection_id" = $1`,
      [collectionId],
    );

    if (this.auditService) {
      await this.auditService.log(organizationId, {
        actorUserId: userId,
        action: 'ARCHIVE_COLLECTION',
        entityType: 'COLLECTION',
        entityId: collectionId,
      });
    }
  }

  // ==========================================
  // 5. BADGES & READER BADGES
  // ==========================================

  async getBadges(organizationId: string): Promise<BadgeDto[]> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    await this.ensureDefaultBadges(tenantDs.manager);

    const rows = await tenantDs.query(`SELECT * FROM "badges" ORDER BY "name" ASC`);
    return rows.map((r: any) => ({
      badgeId: r.badge_id,
      code: r.code,
      name: r.name,
      description: r.description,
      criteria: typeof r.criteria === 'string' ? JSON.parse(r.criteria) : r.criteria,
    }));
  }

  async getUserBadges(organizationId: string, userId: string): Promise<ReaderBadgeDto[]> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    await this.ensureDefaultBadges(tenantDs.manager);

    const rows = await tenantDs.query(
      `SELECT
         rb.user_id,
         rb.badge_id,
         b.code,
         b.name,
         b.description,
         rb.earned_at
       FROM "reader_badges" rb
       JOIN "badges" b ON b.badge_id = rb.badge_id
       WHERE rb.user_id = $1
       ORDER BY rb.earned_at DESC`,
      [userId],
    );

    return rows.map((r: any) => ({
      userId: r.user_id,
      badgeId: r.badge_id,
      code: r.code,
      name: r.name,
      description: r.description,
      earnedAt: new Date(r.earned_at).toISOString(),
    }));
  }

  async awardBadge(
    organizationId: string,
    userId: string,
    badgeCode: string,
    actorUserId?: string,
  ): Promise<ReaderBadgeDto> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);
    await this.ensureDefaultBadges(tenantDs.manager);

    const badgeRows = await tenantDs.query(
      `SELECT * FROM "badges" WHERE "code" = $1`,
      [badgeCode],
    );
    if (badgeRows.length === 0) {
      throw new NotFoundException(`Badge with code ${badgeCode} does not exist`);
    }
    const badge = badgeRows[0];

    const res = await tenantDs.query(
      `INSERT INTO "reader_badges" ("user_id", "badge_id", "earned_at")
       VALUES ($1, $2, NOW())
       ON CONFLICT ("user_id", "badge_id") DO UPDATE SET "earned_at" = "reader_badges"."earned_at"
       RETURNING *`,
      [userId, badge.badge_id],
    );
    const row = this.extractRow<any>(res);

    if (this.auditService && actorUserId) {
      await this.auditService.log(organizationId, {
        actorUserId,
        action: 'AWARD_BADGE',
        entityType: 'READER_BADGE',
        entityId: badge.badge_id,
        newValue: { targetUserId: userId, badgeCode },
      });
    }

    return {
      userId,
      badgeId: badge.badge_id,
      code: badge.code,
      name: badge.name,
      description: badge.description,
      earnedAt: new Date(row.earned_at).toISOString(),
    };
  }

  // ==========================================
  // 6. DEEP LINKS WITH ACCESS VALIDATION
  // ==========================================

  async getDeepLinkCollection(
    organizationId: string,
    collectionId: string,
    requestingUserId?: string,
    isStaff = false,
  ): Promise<SharedCollectionResponse> {
    const collection = await this.getCollectionDetails(
      organizationId,
      collectionId,
      requestingUserId,
      isStaff,
    );

    const isOwner = collection.creatorUserId === requestingUserId;
    const accessLevel = isOwner
      ? 'OWNER'
      : (collection.visibility as 'PUBLIC' | 'UNLISTED');

    return {
      collection,
      isOwner,
      accessLevel,
    };
  }

  async getDeepLinkReview(
    organizationId: string,
    reviewId: string,
    requestingUserId?: string,
    isStaff = false,
  ): Promise<SharedReviewResponse> {
    const tenantDs = await this.tenantConnectionService.getTenantConnection(organizationId);

    const check = await tenantDs.query(
      `SELECT r.*, b.title as "bookTitle"
       FROM "reviews" r
       JOIN "books" b ON b.book_id = r.book_id
       WHERE r.review_id = $1`,
      [reviewId],
    );

    if (check.length === 0) {
      throw new NotFoundException(`Review not found: ${reviewId}`);
    }
    const rev = check[0];

    // Visibility validation
    if (rev.status === 'HIDDEN' || rev.status === 'FLAGGED') {
      if (rev.user_id !== requestingUserId && !isStaff) {
        throw new ForbiddenException('This review is not publicly visible');
      }
    }

    const reviews = await this.getReviewsForBook(
      organizationId,
      rev.book_id,
      requestingUserId,
      isStaff,
    );
    const review = reviews.find((r) => r.reviewId === reviewId);
    if (!review) {
      throw new NotFoundException('Review details could not be retrieved');
    }

    const isAuthorOrStaff = rev.user_id === requestingUserId || isStaff;

    return {
      review,
      bookTitle: rev.bookTitle,
      accessLevel: isAuthorOrStaff ? 'AUTHOR_OR_STAFF' : 'PUBLIC',
    };
  }
}

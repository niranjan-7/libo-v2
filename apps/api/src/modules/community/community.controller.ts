import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommunityService } from './community.service';
import {
  CreateReviewDto,
  VoteReviewDto,
  CreateReviewCommentDto,
  ModerateReviewDto,
  UpdateReviewPolicyDto,
  CreateCollectionDto,
  UpdateCollectionDto,
  AddBookToCollectionDto,
  ReorderCollectionBooksDto,
  AwardBadgeDto,
  ReviewEligibilityQueryDto,
} from './dto/community.dto';
import {
  ReviewDto,
  ReviewCommentDto,
  ReviewPolicyConfigDto,
  ReviewEligibilityDto,
  CollectionDto,
  BadgeDto,
  ReaderBadgeDto,
  SharedCollectionResponse,
  SharedReviewResponse,
  OrgRole,
} from '@library/contracts';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../../common/guards/org-role.guard';
import { RequireOrgRole } from '../../common/decorators/require-org-role.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('organizations/:orgId/community')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  // ==========================================
  // 1. POLICY & ELIGIBILITY
  // ==========================================

  @Get('policy')
  async getPolicy(
    @Param('orgId') orgId: string,
    @Query('libraryId') libraryId?: string,
  ): Promise<ReviewPolicyConfigDto> {
    return this.communityService.getReviewPolicy(orgId, libraryId);
  }

  @Put('policy')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async updatePolicy(
    @Param('orgId') orgId: string,
    @Query('libraryId') libraryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateReviewPolicyDto,
  ): Promise<ReviewPolicyConfigDto> {
    return this.communityService.updateReviewPolicy(orgId, libraryId, user.userId, dto);
  }

  @Get('reviews/eligibility')
  async checkEligibility(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReviewEligibilityQueryDto,
  ): Promise<ReviewEligibilityDto> {
    return this.communityService.checkReviewEligibility(
      orgId,
      query.libraryId,
      user.userId,
      query.bookId,
    );
  }

  // ==========================================
  // 2. REVIEWS & VOTES
  // ==========================================

  @Get('reviews/book/:bookId')
  async getReviewsForBook(
    @Param('orgId') orgId: string,
    @Param('bookId') bookId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ): Promise<ReviewDto[]> {
    const isStaff = [OrgRole.OWNER, OrgRole.ADMIN].includes(req.orgRole);
    return this.communityService.getReviewsForBook(orgId, bookId, user.userId, isStaff);
  }

  @Post('reviews')
  async createReview(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewDto> {
    return this.communityService.createReview(orgId, user.userId, dto);
  }

  @Post('reviews/:reviewId/vote')
  async voteReview(
    @Param('orgId') orgId: string,
    @Param('reviewId') reviewId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VoteReviewDto,
  ): Promise<{ upvotesCount: number; downvotesCount: number; score: number; userVote: number }> {
    return this.communityService.voteReview(orgId, reviewId, user.userId, dto.vote);
  }

  @Put('reviews/:reviewId/moderate')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async moderateReview(
    @Param('orgId') orgId: string,
    @Param('reviewId') reviewId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ModerateReviewDto,
  ): Promise<ReviewDto> {
    return this.communityService.moderateReview(orgId, reviewId, user.userId, dto);
  }

  @Post('reviews/:reviewId/comments')
  async createComment(
    @Param('orgId') orgId: string,
    @Param('reviewId') reviewId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReviewCommentDto,
  ): Promise<ReviewCommentDto> {
    return this.communityService.createReviewComment(orgId, reviewId, user.userId, dto);
  }

  @Get('reviews/:reviewId/comments')
  async getComments(
    @Param('orgId') orgId: string,
    @Param('reviewId') reviewId: string,
  ): Promise<ReviewCommentDto[]> {
    return this.communityService.getReviewComments(orgId, reviewId);
  }

  // ==========================================
  // 3. COLLECTIONS
  // ==========================================

  @Get('collections')
  async getCollections(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ): Promise<CollectionDto[]> {
    const isStaff = [OrgRole.OWNER, OrgRole.ADMIN].includes(req.orgRole);
    return this.communityService.getCollections(orgId, user.userId, isStaff);
  }

  @Post('collections')
  async createCollection(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCollectionDto,
  ): Promise<CollectionDto> {
    return this.communityService.createCollection(orgId, user.userId, dto);
  }

  @Get('collections/:collectionId')
  async getCollectionDetails(
    @Param('orgId') orgId: string,
    @Param('collectionId') collectionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ): Promise<CollectionDto> {
    const isStaff = [OrgRole.OWNER, OrgRole.ADMIN].includes(req.orgRole);
    return this.communityService.getCollectionDetails(orgId, collectionId, user.userId, isStaff);
  }

  @Put('collections/:collectionId')
  async updateCollection(
    @Param('orgId') orgId: string,
    @Param('collectionId') collectionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
    @Body() dto: UpdateCollectionDto,
  ): Promise<CollectionDto> {
    const isStaff = [OrgRole.OWNER, OrgRole.ADMIN].includes(req.orgRole);
    return this.communityService.updateCollection(orgId, collectionId, user.userId, isStaff, dto);
  }

  @Post('collections/:collectionId/books')
  async addBookToCollection(
    @Param('orgId') orgId: string,
    @Param('collectionId') collectionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
    @Body() dto: AddBookToCollectionDto,
  ): Promise<CollectionDto> {
    const isStaff = [OrgRole.OWNER, OrgRole.ADMIN].includes(req.orgRole);
    return this.communityService.addBookToCollection(
      orgId,
      collectionId,
      user.userId,
      isStaff,
      dto.bookId,
    );
  }

  @Delete('collections/:collectionId/books/:bookId')
  async removeBookFromCollection(
    @Param('orgId') orgId: string,
    @Param('collectionId') collectionId: string,
    @Param('bookId') bookId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ): Promise<CollectionDto> {
    const isStaff = [OrgRole.OWNER, OrgRole.ADMIN].includes(req.orgRole);
    return this.communityService.removeBookFromCollection(
      orgId,
      collectionId,
      user.userId,
      isStaff,
      bookId,
    );
  }

  @Put('collections/:collectionId/reorder')
  async reorderCollectionBooks(
    @Param('orgId') orgId: string,
    @Param('collectionId') collectionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
    @Body() dto: ReorderCollectionBooksDto,
  ): Promise<CollectionDto> {
    const isStaff = [OrgRole.OWNER, OrgRole.ADMIN].includes(req.orgRole);
    return this.communityService.reorderCollectionBooks(
      orgId,
      collectionId,
      user.userId,
      isStaff,
      dto.bookIds,
    );
  }

  @Delete('collections/:collectionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCollection(
    @Param('orgId') orgId: string,
    @Param('collectionId') collectionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ): Promise<void> {
    const isStaff = [OrgRole.OWNER, OrgRole.ADMIN].includes(req.orgRole);
    await this.communityService.deleteCollection(orgId, collectionId, user.userId, isStaff);
  }

  // ==========================================
  // 4. BADGES
  // ==========================================

  @Get('badges')
  async getBadges(@Param('orgId') orgId: string): Promise<BadgeDto[]> {
    return this.communityService.getBadges(orgId);
  }

  @Get('badges/my')
  async getMyBadges(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReaderBadgeDto[]> {
    return this.communityService.getUserBadges(orgId, user.userId);
  }

  @Get('badges/user/:userId')
  async getUserBadges(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
  ): Promise<ReaderBadgeDto[]> {
    return this.communityService.getUserBadges(orgId, userId);
  }

  @Post('badges/award')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async awardBadge(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AwardBadgeDto,
  ): Promise<ReaderBadgeDto> {
    return this.communityService.awardBadge(orgId, dto.userId, dto.badgeCode, user.userId);
  }

  // ==========================================
  // 5. DEEP LINKS
  // ==========================================

  @Get('deep-link/collection/:collectionId')
  async getDeepLinkCollection(
    @Param('orgId') orgId: string,
    @Param('collectionId') collectionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ): Promise<SharedCollectionResponse> {
    const isStaff = [OrgRole.OWNER, OrgRole.ADMIN].includes(req.orgRole);
    return this.communityService.getDeepLinkCollection(
      orgId,
      collectionId,
      user.userId,
      isStaff,
    );
  }

  @Get('deep-link/review/:reviewId')
  async getDeepLinkReview(
    @Param('orgId') orgId: string,
    @Param('reviewId') reviewId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ): Promise<SharedReviewResponse> {
    const isStaff = [OrgRole.OWNER, OrgRole.ADMIN].includes(req.orgRole);
    return this.communityService.getDeepLinkReview(
      orgId,
      reviewId,
      user.userId,
      isStaff,
    );
  }
}

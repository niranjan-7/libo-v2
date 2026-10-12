import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  IsArray,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReviewStatus, CollectionVisibility, CollectionStatus } from '@library/contracts';

export class CreateReviewDto {
  @IsUUID()
  @IsNotEmpty()
  bookId!: string;

  @IsUUID()
  @IsOptional()
  libraryId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;
}

export class VoteReviewDto {
  @Type(() => Number)
  @IsInt()
  @IsIn([1, -1, 0])
  vote!: 1 | -1 | 0;
}

export class CreateReviewCommentDto {
  @IsString()
  @IsNotEmpty()
  body!: string;
}

export class ModerateReviewDto {
  @IsString()
  @IsIn(['PUBLISHED', 'FLAGGED', 'HIDDEN'])
  status!: ReviewStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class UpdateReviewPolicyDto {
  @IsBoolean()
  @IsOptional()
  requireBorrowHistory?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  @IsOptional()
  minAccountAgeDays?: number;
}

export class CreateCollectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(['PUBLIC', 'PRIVATE', 'UNLISTED'])
  visibility?: CollectionVisibility;

  @IsArray()
  @IsOptional()
  initialBookIds?: string[];
}

export class UpdateCollectionDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(['PUBLIC', 'PRIVATE', 'UNLISTED'])
  visibility?: CollectionVisibility;

  @IsString()
  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED'])
  status?: CollectionStatus;
}

export class AddBookToCollectionDto {
  @IsUUID()
  @IsNotEmpty()
  bookId!: string;
}

export class ReorderCollectionBooksDto {
  @IsArray()
  @IsNotEmpty()
  bookIds!: string[];
}

export class AwardBadgeDto {
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  badgeCode!: string;
}

export class ReviewEligibilityQueryDto {
  @IsUUID()
  @IsNotEmpty()
  bookId!: string;

  @IsUUID()
  @IsOptional()
  libraryId?: string;
}

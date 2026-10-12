import {
  IsString,
  MinLength,
  Matches,
  IsOptional,
  IsEmail,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  OrgRole,
  CreateOrganizationRequest,
  CreateLibraryRequest,
  InviteMemberRequest,
  AcceptInviteRequest,
} from '@library/contracts';

export class CreateOrganizationDto implements CreateOrganizationRequest {
  @IsString()
  @MinLength(2, { message: 'Organization name must be at least 2 characters long' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  name!: string;

  @IsString()
  @MinLength(2, { message: 'Slug must be at least 2 characters long' })
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must contain only lowercase letters, numbers, and hyphens' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  slug!: string;

  @IsOptional()
  @IsString()
  initialLibraryName?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class CreateLibraryDto implements CreateLibraryRequest {
  @IsString()
  @MinLength(2, { message: 'Library name must be at least 2 characters long' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  name!: string;

  @IsString()
  @MinLength(2, { message: 'Slug must be at least 2 characters long' })
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must contain only lowercase letters, numbers, and hyphens' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  slug!: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class InviteMemberDto implements InviteMemberRequest {
  @IsEmail({}, { message: 'Please provide a valid email address to invite' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email!: string;

  @IsEnum(OrgRole, { message: 'Proposed role must be OWNER, ADMIN, or MEMBER' })
  proposedRole!: OrgRole;

  @IsOptional()
  @IsString()
  targetLibraryId?: string;
}

export class AcceptInviteDto implements AcceptInviteRequest {
  @IsString()
  @IsNotEmpty({ message: 'Invitation token is required' })
  token!: string;
}

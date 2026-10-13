import { IsOptional, IsString } from 'class-validator';
import { CreateAccessRequestRequest, ReviewAccessRequestRequest } from '@library/contracts';

export class CreateAccessRequestDto implements CreateAccessRequestRequest {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReviewAccessRequestDto implements ReviewAccessRequestRequest {
  @IsOptional()
  @IsString()
  reason?: string;
}

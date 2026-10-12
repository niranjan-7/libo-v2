import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsInt,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CopyCondition, CopyStatus } from '@library/contracts';

export class CatalogQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  sort?: 'relevance' | 'title' | 'year';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export class CreateBookCopyDto {
  @IsUUID()
  editionId!: string;

  @IsString()
  @IsNotEmpty()
  barcode!: string;

  @IsEnum(CopyCondition)
  @IsOptional()
  condition: CopyCondition = CopyCondition.GOOD;

  @IsEnum(CopyStatus)
  @IsOptional()
  status: CopyStatus = CopyStatus.AVAILABLE;

  @IsUUID()
  homeLocationId!: string;
}

export class InventoryQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(CopyStatus)
  status?: CopyStatus;

  @IsOptional()
  @IsEnum(CopyCondition)
  condition?: CopyCondition;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 25;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

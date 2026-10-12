import { IsString, IsNotEmpty, IsEnum, IsNumber, IsPositive, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { FineType, FineStatus } from '@library/contracts';

export class FinesQueryDto {
  @IsOptional()
  @IsString()
  readerUserId?: string;

  @IsOptional()
  @IsEnum(FineStatus)
  status?: FineStatus;

  @IsOptional()
  @IsEnum(FineType)
  fineType?: FineType;

  @IsOptional()
  @IsString()
  loanId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

export class CreateManualFineDto {
  @IsString()
  @IsNotEmpty()
  readerUserId: string;

  @IsEnum(FineType)
  fineType: FineType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  loanId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PayFineDto {
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class WaiveFineDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

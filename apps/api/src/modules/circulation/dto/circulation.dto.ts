import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CopyCondition, CopyStatus, ReservationStatus, LoanStatus } from '@library/contracts';

export class CheckoutDto {
  @IsString()
  @IsNotEmpty()
  barcode!: string;

  @IsUUID()
  readerUserId!: string;

  @IsUUID()
  @IsOptional()
  reservationId?: string;
}

export class ReturnDto {
  @IsString()
  @IsNotEmpty()
  barcode!: string;

  @IsEnum(CopyCondition)
  @IsOptional()
  condition?: CopyCondition;
}

export class CreateReservationDto {
  @IsUUID()
  editionId!: string;

  @IsUUID()
  @IsOptional()
  readerUserId?: string;
}

export class ReadyForPickupDto {
  @IsUUID()
  @IsOptional()
  pickupLocationId?: string;
}

export class UpdateCirculationPolicyDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  loanPeriodDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  extensionIncrementDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  maxExtensions?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxActiveLoans?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxPendingReservations?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(12)
  @Max(336)
  pickupWindowHours?: number;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dailyOverdueFineRate?: number;
}

export class LoansQueryDto {
  @IsOptional()
  @IsUUID()
  readerUserId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export class ReservationsQueryDto {
  @IsOptional()
  @IsUUID()
  readerUserId?: string;

  @IsOptional()
  @IsUUID()
  editionId?: string;

  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

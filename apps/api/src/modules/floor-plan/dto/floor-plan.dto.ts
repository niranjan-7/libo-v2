import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsNumber,
  IsArray,
  ValidateNested,
  MaxLength,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SpatialElementType } from '@library/contracts';

export class CreateFloorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(-5)
  @Max(50)
  floorNumber!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(400)
  @Max(5000)
  @IsOptional()
  canvasWidth?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(400)
  @Max(5000)
  @IsOptional()
  canvasHeight?: number;
}

export class UpdateFloorDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(400)
  @Max(5000)
  @IsOptional()
  canvasWidth?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(400)
  @Max(5000)
  @IsOptional()
  canvasHeight?: number;
}

export class SaveSpatialElementDto {
  @IsString()
  @IsOptional()
  elementId?: string;

  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['RACK', 'WALL', 'DOOR', 'DESK'])
  elementType!: SpatialElementType | string;

  @Type(() => Number)
  @IsNumber()
  x!: number;

  @Type(() => Number)
  @IsNumber()
  y!: number;

  @Type(() => Number)
  @IsNumber()
  width!: number;

  @Type(() => Number)
  @IsNumber()
  height!: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  rotation?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  zIndex?: number;

  @IsUUID()
  @IsOptional()
  linkedLocationId?: string | null;

  @IsOptional()
  properties?: Record<string, any>;
}

export class SaveFloorPlanDraftDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveSpatialElementDto)
  elements!: SaveSpatialElementDto[];
}

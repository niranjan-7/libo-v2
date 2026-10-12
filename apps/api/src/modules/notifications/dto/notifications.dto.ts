import { IsString, IsNotEmpty, IsOptional, IsObject, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationChannel } from '@library/contracts';

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsOptional()
  libraryId?: string;

  @IsString()
  @IsNotEmpty()
  eventType: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsObject()
  @IsOptional()
  payload?: Record<string, any>;

  @IsString()
  @IsNotEmpty()
  dedupeKey: string;

  @IsOptional()
  channels?: NotificationChannel[];
}

export class NotificationsQueryDto {
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

  @IsOptional()
  unreadOnly?: boolean;
}

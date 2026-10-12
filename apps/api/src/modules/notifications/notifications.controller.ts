import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationDto } from '@library/contracts';
import { NotificationsQueryDto } from './dto/notifications.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../../common/guards/org-role.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('organizations/:orgId/libraries/:libraryId/notifications')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Retrieves inbox for the current user
   */
  @Get()
  async getMyNotifications(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationsQueryDto,
  ): Promise<{ items: NotificationDto[]; total: number; unreadCount: number }> {
    return this.notificationsService.getUserNotifications(orgId, user.userId, query);
  }

  /**
   * Marks a single notification as read
   */
  @Post(':notificationId/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @Param('orgId') orgId: string,
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationDto> {
    return this.notificationsService.markAsRead(orgId, user.userId, notificationId);
  }

  /**
   * Marks all notifications as read for current user
   */
  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ affectedCount: number }> {
    return this.notificationsService.markAllAsRead(orgId, user.userId);
  }
}

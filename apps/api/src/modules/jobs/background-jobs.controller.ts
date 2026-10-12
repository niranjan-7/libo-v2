import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BackgroundJobsService } from './background-jobs.service';
import { JobRunResultDto, OrgRole } from '@library/contracts';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../../common/guards/org-role.guard';
import { RequireOrgRole } from '../../common/decorators/require-org-role.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('organizations/:orgId/libraries/:libraryId/jobs')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class BackgroundJobsController {
  constructor(private readonly jobsService: BackgroundJobsService) {}

  @Post('run-overdue-fines')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async runOverdueFines(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<JobRunResultDto> {
    return this.jobsService.runOverdueFineSweep(orgId, libraryId, user.userId);
  }

  @Post('run-hold-expiries')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async runHoldExpiries(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<JobRunResultDto> {
    return this.jobsService.runHoldExpirySweep(orgId, libraryId, user.userId);
  }

  @Post('run-notification-deliveries')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async runNotificationDeliveries(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
  ): Promise<JobRunResultDto> {
    return this.jobsService.runNotificationDeliverySweep(orgId, libraryId);
  }

  @Get('status')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async getStatus(): Promise<{ activeRunningJobs: string[] }> {
    return {
      activeRunningJobs: this.jobsService.getActiveJobs(),
    };
  }
}

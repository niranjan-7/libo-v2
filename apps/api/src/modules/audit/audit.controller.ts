import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { SystemAuditLogDto, OrgRole } from '@library/contracts';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../../common/guards/org-role.guard';
import { RequireOrgRole } from '../../common/decorators/require-org-role.decorator';

@Controller('organizations/:orgId/libraries/:libraryId/audit-logs')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async getAuditLogs(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ): Promise<{ items: SystemAuditLogDto[]; total: number }> {
    return this.auditService.queryLogs(orgId, {
      libraryId,
      actorUserId,
      action,
      entityType,
      limit: Number(limit),
      offset: Number(offset),
    });
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FinesService } from './fines.service';
import {
  FinesQueryDto,
  CreateManualFineDto,
  PayFineDto,
  WaiveFineDto,
} from './dto/fines.dto';
import {
  FineDto,
  GenerateOverdueFinesResponse,
  OrgRole,
} from '@library/contracts';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../../common/guards/org-role.guard';
import { RequireOrgRole } from '../../common/decorators/require-org-role.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('organizations/:orgId/libraries/:libraryId/fines')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class FinesController {
  constructor(private readonly finesService: FinesService) {}

  /**
   * Queries branch fines (readers see their own, staff see all)
   */
  @Get()
  async getFines(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
    @Query() query: FinesQueryDto,
  ): Promise<{ items: FineDto[]; total: number; totalOutstanding: number }> {
    // If not admin/owner, restrict query to user's own fines
    const isStaff = [OrgRole.OWNER, OrgRole.ADMIN].includes(req.orgRole);
    const effectiveQuery = isStaff
      ? query
      : { ...query, readerUserId: user.userId };

    return this.finesService.getFines(orgId, libraryId, effectiveQuery);
  }

  /**
   * Staff assesses a manual fine (e.g. Damage fee, lost book)
   */
  @Post()
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async createManualFine(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateManualFineDto,
  ): Promise<FineDto> {
    return this.finesService.createManualFine(orgId, libraryId, user.userId, dto);
  }

  /**
   * Generates overdue fines for loans past their due date
   */
  @Post('generate-overdue')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async generateOverdueFines(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
  ): Promise<GenerateOverdueFinesResponse> {
    return this.finesService.generateOverdueFines(orgId, libraryId);
  }

  /**
   * Reader or staff settles an outstanding fine using reader wallet balance
   */
  @Post(':fineId/pay')
  @HttpCode(HttpStatus.OK)
  async payFine(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('fineId') fineId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PayFineDto,
  ): Promise<{ fine: FineDto; newWalletBalance: number }> {
    return this.finesService.payFine(orgId, libraryId, user.userId, fineId, dto);
  }

  /**
   * Staff waives a fine liability (requires reason, records audit trail)
   */
  @Post(':fineId/waive')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async waiveFine(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('fineId') fineId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: WaiveFineDto,
  ): Promise<FineDto> {
    return this.finesService.waiveFine(orgId, libraryId, user.userId, fineId, dto);
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FloorPlanService } from './floor-plan.service';
import {
  CreateFloorDto,
  UpdateFloorDto,
  SaveFloorPlanDraftDto,
} from './dto/floor-plan.dto';
import {
  LibraryFloorDto,
  FloorPlanVersionDto,
  ValidateFloorPlanResponse,
  PublishFloorPlanResponse,
  LogicalRackDto,
  FloorPlanResponse,
  FloorCirculationHeatmapResponse,
  OrgRole,
} from '@library/contracts';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../../common/guards/org-role.guard';
import { RequireOrgRole } from '../../common/decorators/require-org-role.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('organizations/:orgId/libraries/:libraryId/floors')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class FloorPlanController {
  constructor(private readonly floorPlanService: FloorPlanService) {}

  // ==========================================
  // 1. FLOOR MANAGEMENT
  // ==========================================

  @Get()
  async getFloors(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
  ): Promise<LibraryFloorDto[]> {
    return this.floorPlanService.getFloors(orgId, libraryId);
  }

  @Post()
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async createFloor(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFloorDto,
  ): Promise<LibraryFloorDto> {
    return this.floorPlanService.createFloor(orgId, libraryId, user.userId, dto);
  }

  @Get(':floorId')
  async getFloor(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('floorId') floorId: string,
  ): Promise<LibraryFloorDto> {
    return this.floorPlanService.getFloor(orgId, libraryId, floorId);
  }

  @Put(':floorId')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async updateFloor(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('floorId') floorId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFloorDto,
  ): Promise<LibraryFloorDto> {
    return this.floorPlanService.updateFloor(orgId, libraryId, floorId, user.userId, dto);
  }

  @Delete(':floorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async deleteFloor(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('floorId') floorId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.floorPlanService.deleteFloor(orgId, libraryId, floorId, user.userId);
  }

  // ==========================================
  // 2. LOGICAL RACKS
  // ==========================================

  @Get(':floorId/racks')
  async getLogicalRacks(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('floorId') floorId: string,
  ): Promise<LogicalRackDto[]> {
    return this.floorPlanService.getLogicalRacks(orgId, libraryId, floorId);
  }

  // ==========================================
  // 3. VERSIONS & PUBLISHED VIEWS
  // ==========================================

  @Get(':floorId/versions')
  async getVersions(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('floorId') floorId: string,
    @Req() req: any,
  ): Promise<FloorPlanVersionDto[]> {
    const isStaff = [OrgRole.OWNER, OrgRole.ADMIN].includes(req.orgRole);
    return this.floorPlanService.getVersions(orgId, libraryId, floorId, isStaff);
  }

  @Get(':floorId/published')
  async getPublishedFloorPlan(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('floorId') floorId: string,
  ): Promise<FloorPlanResponse> {
    return this.floorPlanService.getPublishedFloorPlan(orgId, libraryId, floorId);
  }

  @Get('published-level/:floorNumber')
  async getPublishedFloorPlanByNumber(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('floorNumber') floorNumber: string,
  ): Promise<FloorPlanResponse> {
    return this.floorPlanService.getPublishedFloorPlan(orgId, libraryId, parseInt(floorNumber, 10));
  }

  @Get(':floorId/heatmap')
  async getCirculationHeatmap(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('floorId') floorId: string,
    @Query('timeRange') timeRange?: '30d' | '90d' | 'all',
  ): Promise<FloorCirculationHeatmapResponse> {
    return this.floorPlanService.getCirculationHeatmap(
      orgId,
      libraryId,
      floorId,
      timeRange || '30d',
    );
  }

  // ==========================================
  // 4. DRAFT STUDIO & RESTORE
  // ==========================================

  @Get(':floorId/draft')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async getOrCreateDraft(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('floorId') floorId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FloorPlanVersionDto> {
    return this.floorPlanService.getOrCreateDraft(orgId, libraryId, floorId, user.userId);
  }

  @Put(':floorId/draft/:versionId')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async saveDraft(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('floorId') floorId: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveFloorPlanDraftDto,
  ): Promise<FloorPlanVersionDto> {
    return this.floorPlanService.saveDraft(
      orgId,
      libraryId,
      floorId,
      versionId,
      user.userId,
      dto,
    );
  }

  @Post(':floorId/draft/:versionId/validate')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async validateDraft(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('floorId') floorId: string,
    @Param('versionId') versionId: string,
  ): Promise<ValidateFloorPlanResponse> {
    return this.floorPlanService.validateDraft(orgId, libraryId, floorId, versionId);
  }

  @Post(':floorId/draft/:versionId/publish')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async publishDraft(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('floorId') floorId: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PublishFloorPlanResponse> {
    return this.floorPlanService.publishDraft(
      orgId,
      libraryId,
      floorId,
      versionId,
      user.userId,
    );
  }

  @Post(':floorId/versions/:versionId/restore')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async restoreVersion(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('floorId') floorId: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FloorPlanVersionDto> {
    return this.floorPlanService.restoreVersion(
      orgId,
      libraryId,
      floorId,
      versionId,
      user.userId,
    );
  }
}

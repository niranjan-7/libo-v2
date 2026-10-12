import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  OrgRole,
  OrganizationDetailsResponse,
  LibraryDto,
} from '@library/contracts';
import { OrganizationsService } from './organizations.service';
import {
  CreateOrganizationDto,
  CreateLibraryDto,
  InviteMemberDto,
  AcceptInviteDto,
} from './dto/organization.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../../common/guards/org-role.guard';
import { RequireOrgRole } from '../../common/decorators/require-org-role.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly orgService: OrganizationsService) {}

  @Post()
  async createOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
  ): Promise<OrganizationDetailsResponse> {
    return this.orgService.createOrganization(user.userId, dto);
  }

  @Get()
  async getUserOrganizations(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrganizationDetailsResponse[]> {
    return this.orgService.getUserOrganizations(user.userId);
  }

  @Get(':orgId')
  @UseGuards(OrgRoleGuard)
  async getOrganizationDetails(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrganizationDetailsResponse> {
    return this.orgService.getOrganizationDetails(orgId, user.userId);
  }

  @Post(':orgId/libraries')
  @UseGuards(OrgRoleGuard)
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async createLibrary(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLibraryDto,
  ): Promise<LibraryDto> {
    return this.orgService.createLibrary(orgId, user.userId, dto);
  }

  @Post(':orgId/invitations')
  @UseGuards(OrgRoleGuard)
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async inviteMember(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteMemberDto,
  ) {
    return this.orgService.inviteMember(orgId, user.userId, dto);
  }

  @Get(':orgId/members')
  @UseGuards(OrgRoleGuard)
  async getMembers(@Param('orgId') orgId: string) {
    return this.orgService.getMembers(orgId);
  }

  @Get(':orgId/invitations')
  @UseGuards(OrgRoleGuard)
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async getInvitations(@Param('orgId') orgId: string) {
    return this.orgService.getInvitations(orgId);
  }

  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AcceptInviteDto,
  ) {
    return this.orgService.acceptInvitation(user.userId, dto.token);
  }
}

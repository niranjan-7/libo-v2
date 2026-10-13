import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  LibraryDirectoryEntryDto,
  ReaderAccessRequestDto,
  UserLibraryMembershipDto,
} from '@library/contracts';
import { LibrariesService } from './libraries.service';
import { CreateAccessRequestDto, ReviewAccessRequestDto } from './dto/access-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('libraries')
export class LibrariesController {
  constructor(private readonly librariesService: LibrariesService) {}

  /**
   * Public / Authenticated discovery of libraries
   */
  @Get('directory')
  @UseGuards(OptionalJwtAuthGuard)
  async getDirectory(
    @CurrentUser() user: AuthenticatedUser | null,
  ): Promise<LibraryDirectoryEntryDto[]> {
    return this.librariesService.getDirectory(user?.userId);
  }

  /**
   * Returns all libraries where the user has active membership
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyLibraries(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserLibraryMembershipDto[]> {
    return this.librariesService.getMyLibraries(user.userId);
  }

  /**
   * Reader submits an access request to join a library
   */
  @Post(':libraryId/access-requests')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async submitAccessRequest(
    @Param('libraryId') libraryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAccessRequestDto,
  ): Promise<ReaderAccessRequestDto> {
    return this.librariesService.submitAccessRequest(user.userId, libraryId, dto);
  }
}

@Controller('organizations/:orgId/libraries/:libraryId/access-requests')
@UseGuards(JwtAuthGuard)
export class StaffAccessRequestsController {
  constructor(private readonly librariesService: LibrariesService) {}

  /**
   * Staff views pending reader access requests for their library
   */
  @Get()
  async getAccessRequests(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReaderAccessRequestDto[]> {
    return this.librariesService.getAccessRequests(orgId, libraryId, user.userId);
  }

  /**
   * Staff approves reader request and provisions active membership
   */
  @Post(':requestId/approve')
  @HttpCode(HttpStatus.OK)
  async approveAccessRequest(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReaderAccessRequestDto> {
    return this.librariesService.approveAccessRequest(orgId, libraryId, requestId, user.userId);
  }

  /**
   * Staff rejects reader access request
   */
  @Post(':requestId/reject')
  @HttpCode(HttpStatus.OK)
  async rejectAccessRequest(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewAccessRequestDto,
  ): Promise<ReaderAccessRequestDto> {
    return this.librariesService.rejectAccessRequest(orgId, libraryId, requestId, user.userId, dto);
  }
}

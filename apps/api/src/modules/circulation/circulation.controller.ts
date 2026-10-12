import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  CirculationPolicyDto,
  LoanDto,
  ReservationDto,
  CirculationDeskStatsResponse,
  OrgRole,
} from '@library/contracts';
import { CirculationService } from './circulation.service';
import {
  CheckoutDto,
  ReturnDto,
  CreateReservationDto,
  ReadyForPickupDto,
  UpdateCirculationPolicyDto,
  LoansQueryDto,
  ReservationsQueryDto,
} from './dto/circulation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../../common/guards/org-role.guard';
import { RequireOrgRole } from '../../common/decorators/require-org-role.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('organizations/:orgId/libraries/:libraryId/circulation')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class CirculationController {
  constructor(private readonly circulationService: CirculationService) {}

  /**
   * Walk-in or reservation checkout
   */
  @Post('checkout')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async checkout(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckoutDto,
  ): Promise<LoanDto> {
    return this.circulationService.checkout(orgId, libraryId, user.userId, dto);
  }

  /**
   * Return a physical copy
   */
  @Post('return')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async returnCopy(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReturnDto,
  ) {
    return this.circulationService.returnCopy(orgId, libraryId, user.userId, dto);
  }

  /**
   * Reader or staff reserves an edition
   */
  @Post('reservations')
  async createReservation(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReservationDto,
  ): Promise<ReservationDto> {
    return this.circulationService.createReservation(orgId, libraryId, user.userId, dto);
  }

  /**
   * Staff confirms copy is physically placed and ready for reader pickup (starts 72h window)
   */
  @Post('reservations/:reservationId/ready-for-pickup')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async markReadyForPickup(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('reservationId') reservationId: string,
    @Body() dto: ReadyForPickupDto,
  ): Promise<ReservationDto> {
    return this.circulationService.markReadyForPickup(
      orgId,
      libraryId,
      user.userId,
      reservationId,
      dto,
    );
  }

  /**
   * Cancel an active reservation
   */
  @Post('reservations/:reservationId/cancel')
  async cancelReservation(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('reservationId') reservationId: string,
  ): Promise<ReservationDto> {
    return this.circulationService.cancelReservation(orgId, libraryId, user.userId, reservationId);
  }

  /**
   * Trigger expiry sweep of stale pickup-ready reservations
   */
  @Post('reservations/process-expiries')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async processExpiries(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
  ): Promise<{ expiredCount: number; reassignedCount: number }> {
    return this.circulationService.processExpiries(orgId, libraryId);
  }

  /**
   * Extend an active loan
   */
  @Post('loans/:loanId/extend')
  async extendLoan(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('loanId') loanId: string,
  ): Promise<LoanDto> {
    return this.circulationService.extendLoan(orgId, libraryId, user.userId, loanId);
  }

  /**
   * Query loans
   */
  @Get('loans')
  async getLoans(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Query() query: LoansQueryDto,
  ): Promise<{ items: LoanDto[]; total: number }> {
    return this.circulationService.getLoans(orgId, libraryId, query);
  }

  /**
   * Query reservations
   */
  @Get('reservations')
  async getReservations(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Query() query: ReservationsQueryDto,
  ): Promise<{ items: ReservationDto[]; total: number }> {
    return this.circulationService.getReservations(orgId, libraryId, query);
  }

  /**
   * Get branch circulation policy
   */
  @Get('policy')
  async getPolicy(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
  ): Promise<CirculationPolicyDto> {
    return this.circulationService.getCirculationPolicy(orgId, libraryId);
  }

  /**
   * Update branch circulation policy
   */
  @Put('policy')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async updatePolicy(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCirculationPolicyDto,
  ): Promise<CirculationPolicyDto> {
    return this.circulationService.updateCirculationPolicy(orgId, libraryId, user.userId, dto);
  }

  /**
   * Circulation desk summary stats
   */
  @Get('stats')
  async getStats(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
  ): Promise<CirculationDeskStatsResponse> {
    return this.circulationService.getCirculationStats(orgId, libraryId);
  }

  /**
   * Reader's current circulation overview (active loans and reservations)
   */
  @Get('my-circulation')
  async getMyCirculation(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.circulationService.getReaderCirculation(orgId, libraryId, user.userId);
  }
}

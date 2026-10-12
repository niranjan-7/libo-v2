import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { TopUpDto, WalletTransactionsQueryDto } from './dto/wallet.dto';
import { WalletDto, WalletTransactionDto, OrgRole } from '@library/contracts';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../../common/guards/org-role.guard';
import { RequireOrgRole } from '../../common/decorators/require-org-role.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('organizations/:orgId/libraries/:libraryId/wallets')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /**
   * Retrieves wallet balance for the authenticated user
   */
  @Get('me')
  async getMyWallet(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WalletDto> {
    return this.walletService.getWallet(orgId, libraryId, user.userId);
  }

  /**
   * Retrieves transaction ledger for the authenticated user
   */
  @Get('me/transactions')
  async getMyTransactions(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WalletTransactionsQueryDto,
  ): Promise<{ items: WalletTransactionDto[]; total: number; balance: number }> {
    return this.walletService.getTransactions(orgId, libraryId, user.userId, query);
  }

  /**
   * Simulated instant wallet balance top-up
   */
  @Post('me/top-up')
  @HttpCode(HttpStatus.OK)
  async topUp(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TopUpDto,
  ): Promise<{ wallet: WalletDto; transaction: WalletTransactionDto; isDuplicate: boolean }> {
    return this.walletService.topUp(orgId, libraryId, user.userId, dto);
  }

  /**
   * Staff inspects a member's wallet
   */
  @Get(':userId')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async getMemberWallet(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('userId') targetUserId: string,
  ): Promise<WalletDto> {
    return this.walletService.getWallet(orgId, libraryId, targetUserId);
  }

  /**
   * Staff inspects a member's wallet transaction ledger
   */
  @Get(':userId/transactions')
  @RequireOrgRole(OrgRole.OWNER, OrgRole.ADMIN)
  async getMemberTransactions(
    @Param('orgId') orgId: string,
    @Param('libraryId') libraryId: string,
    @Param('userId') targetUserId: string,
    @Query() query: WalletTransactionsQueryDto,
  ): Promise<{ items: WalletTransactionDto[]; total: number; balance: number }> {
    return this.walletService.getTransactions(orgId, libraryId, targetUserId, query);
  }
}

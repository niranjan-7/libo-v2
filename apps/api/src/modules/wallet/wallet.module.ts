import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgMembershipEntity } from '../../database/control-plane/entities/org-membership.entity';
import { TenantConnectionModule } from '../tenant-connection/tenant-connection.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrgMembershipEntity]),
    TenantConnectionModule,
    NotificationsModule,
    AuditModule,
  ],
  providers: [WalletService],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}

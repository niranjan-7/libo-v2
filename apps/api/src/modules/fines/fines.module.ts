import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgMembershipEntity } from '../../database/control-plane/entities/org-membership.entity';
import { TenantConnectionModule } from '../tenant-connection/tenant-connection.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { WalletModule } from '../wallet/wallet.module';
import { FinesService } from './fines.service';
import { FinesController } from './fines.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrgMembershipEntity]),
    TenantConnectionModule,
    NotificationsModule,
    AuditModule,
    WalletModule,
  ],
  providers: [FinesService],
  controllers: [FinesController],
  exports: [FinesService],
})
export class FinesModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgMembershipEntity } from '../../database/control-plane/entities/org-membership.entity';
import { TenantConnectionModule } from '../tenant-connection/tenant-connection.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrgMembershipEntity]),
    TenantConnectionModule,
  ],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}

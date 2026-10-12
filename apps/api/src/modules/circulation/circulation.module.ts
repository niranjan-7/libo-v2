import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgMembershipEntity } from '../../database/control-plane/entities/org-membership.entity';
import { CirculationController } from './circulation.controller';
import { CirculationService } from './circulation.service';
import { TenantConnectionModule } from '../tenant-connection/tenant-connection.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { OrgRoleGuard } from '../../common/guards/org-role.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrgMembershipEntity]),
    TenantConnectionModule,
    NotificationsModule,
    AuditModule,
  ],
  controllers: [CirculationController],
  providers: [CirculationService, OrgRoleGuard],
  exports: [CirculationService],
})
export class CirculationModule {}

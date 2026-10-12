import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgMembershipEntity } from '../../database/control-plane/entities/org-membership.entity';
import { TenantConnectionModule } from '../tenant-connection/tenant-connection.module';
import { FinesModule } from '../fines/fines.module';
import { CirculationModule } from '../circulation/circulation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { BackgroundJobsService } from './background-jobs.service';
import { BackgroundJobsController } from './background-jobs.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrgMembershipEntity]),
    TenantConnectionModule,
    FinesModule,
    CirculationModule,
    NotificationsModule,
    AuditModule,
  ],
  providers: [BackgroundJobsService],
  controllers: [BackgroundJobsController],
  exports: [BackgroundJobsService],
})
export class BackgroundJobsModule {}

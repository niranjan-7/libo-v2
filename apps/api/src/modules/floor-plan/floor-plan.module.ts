import { Module } from '@nestjs/common';
import { FloorPlanService } from './floor-plan.service';
import { FloorPlanController } from './floor-plan.controller';
import { TenantConnectionModule } from '../tenant-connection/tenant-connection.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TenantConnectionModule, AuditModule],
  controllers: [FloorPlanController],
  providers: [FloorPlanService],
  exports: [FloorPlanService],
})
export class FloorPlanModule {}

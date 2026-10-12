import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgMembershipEntity } from '../../database/control-plane/entities/org-membership.entity';
import { TenantConnectionModule } from '../tenant-connection/tenant-connection.module';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrgMembershipEntity]),
    TenantConnectionModule,
  ],
  providers: [AuditService],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}

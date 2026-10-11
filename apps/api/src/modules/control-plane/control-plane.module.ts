import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantDatabaseRegistryEntity } from '../../database/control-plane/entities/tenant-registry.entity';
import { OrganizationEntity } from '../../database/control-plane/entities/organization.entity';
import { UserEntity } from '../../database/control-plane/entities/user.entity';
import { OrgMembershipEntity } from '../../database/control-plane/entities/org-membership.entity';
import { OrgInvitationEntity } from '../../database/control-plane/entities/org-invitation.entity';
import { ControlPlaneAuditLogEntity } from '../../database/control-plane/entities/control-plane-audit.entity';
import { TenantDatabaseRegistryService } from './tenant-database-registry.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantDatabaseRegistryEntity,
      OrganizationEntity,
      UserEntity,
      OrgMembershipEntity,
      OrgInvitationEntity,
      ControlPlaneAuditLogEntity,
    ]),
  ],
  providers: [TenantDatabaseRegistryService],
  exports: [TenantDatabaseRegistryService, TypeOrmModule],
})
export class ControlPlaneModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationEntity } from '../../database/control-plane/entities/organization.entity';
import { OrgMembershipEntity } from '../../database/control-plane/entities/org-membership.entity';
import { OrgInvitationEntity } from '../../database/control-plane/entities/org-invitation.entity';
import { UserEntity } from '../../database/control-plane/entities/user.entity';
import { ControlPlaneAuditLogEntity } from '../../database/control-plane/entities/control-plane-audit.entity';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { InvitationsController } from './invitations.controller';
import { OrgRoleGuard } from '../../common/guards/org-role.guard';
import { TenantConnectionModule } from '../tenant-connection/tenant-connection.module';
import { ControlPlaneModule } from '../control-plane/control-plane.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationEntity,
      OrgMembershipEntity,
      OrgInvitationEntity,
      UserEntity,
      ControlPlaneAuditLogEntity,
    ]),
    ControlPlaneModule,
    TenantConnectionModule,
  ],
  providers: [OrganizationsService, OrgRoleGuard],
  controllers: [OrganizationsController, InvitationsController],
  exports: [OrganizationsService, OrgRoleGuard],
})
export class OrganizationsModule {}

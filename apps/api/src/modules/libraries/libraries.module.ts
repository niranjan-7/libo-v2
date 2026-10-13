import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LibraryDirectoryEntity } from '../../database/control-plane/entities/library-directory.entity';
import { OrganizationEntity } from '../../database/control-plane/entities/organization.entity';
import { OrgMembershipEntity } from '../../database/control-plane/entities/org-membership.entity';
import { UserEntity } from '../../database/control-plane/entities/user.entity';
import { TenantConnectionModule } from '../tenant-connection/tenant-connection.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LibrariesService } from './libraries.service';
import { LibrariesController, StaffAccessRequestsController } from './libraries.controller';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LibraryDirectoryEntity,
      OrganizationEntity,
      OrgMembershipEntity,
      UserEntity,
    ]),
    TenantConnectionModule,
    NotificationsModule,
  ],
  controllers: [LibrariesController, StaffAccessRequestsController],
  providers: [LibrariesService, OptionalJwtAuthGuard, JwtAuthGuard],
  exports: [LibrariesService],
})
export class LibrariesModule {}

import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { UserEntity } from '../database/control-plane/entities/user.entity';
import { OrganizationEntity } from '../database/control-plane/entities/organization.entity';
import { OrgMembershipEntity } from '../database/control-plane/entities/org-membership.entity';
import { OrgInvitationEntity } from '../database/control-plane/entities/org-invitation.entity';
import { TenantDatabaseRegistryEntity } from '../database/control-plane/entities/tenant-registry.entity';
import { ControlPlaneAuditLogEntity } from '../database/control-plane/entities/control-plane-audit.entity';
import { LibraryDirectoryEntity } from '../database/control-plane/entities/library-directory.entity';
import { InitialControlPlane1700000000000 } from '../database/control-plane/migrations/1700000000000-InitialControlPlane';
import { AddUserDisplayName1700000000002 } from '../database/control-plane/migrations/1700000000002-AddUserDisplayName';
import { CreateLibrariesDirectory1700000000003 } from '../database/control-plane/migrations/1700000000003-CreateLibrariesDirectory';

export function getControlPlaneTypeOrmConfig(configService: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: configService.get<string>('CONTROL_PLANE_DB_HOST', 'localhost'),
    port: Number(configService.get<number>('CONTROL_PLANE_DB_PORT', 5432)),
    username: configService.get<string>('CONTROL_PLANE_DB_USER', 'postgres'),
    password: configService.get<string>('CONTROL_PLANE_DB_PASSWORD', 'postgres'),
    database: configService.get<string>('CONTROL_PLANE_DB_NAME', 'control_plane_db'),
    entities: [
      UserEntity,
      OrganizationEntity,
      OrgMembershipEntity,
      OrgInvitationEntity,
      TenantDatabaseRegistryEntity,
      ControlPlaneAuditLogEntity,
      LibraryDirectoryEntity,
    ],
    migrations: [
      InitialControlPlane1700000000000,
      AddUserDisplayName1700000000002,
      CreateLibrariesDirectory1700000000003,
    ],
    migrationsRun: false,
    synchronize: false, // Strict requirement: do not use synchronize in production
    logging: configService.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : false,
    extra: {
      max: 15,
      idleTimeoutMillis: 30000,
    },
  };
}

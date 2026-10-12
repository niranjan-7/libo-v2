import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgMembershipEntity } from '../../database/control-plane/entities/org-membership.entity';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { TenantConnectionModule } from '../tenant-connection/tenant-connection.module';
import { OrgRoleGuard } from '../../common/guards/org-role.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrgMembershipEntity]),
    TenantConnectionModule,
  ],
  controllers: [CatalogController],
  providers: [CatalogService, OrgRoleGuard],
  exports: [CatalogService],
})
export class CatalogModule {}

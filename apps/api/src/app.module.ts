import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnvironment } from './config/env.validation';
import { getControlPlaneTypeOrmConfig } from './config/database.config';
import { HealthModule } from './modules/health/health.module';
import { ControlPlaneModule } from './modules/control-plane/control-plane.module';
import { TenantConnectionModule } from './modules/tenant-connection/tenant-connection.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CirculationModule } from './modules/circulation/circulation.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { FinesModule } from './modules/fines/fines.module';
import { BackgroundJobsModule } from './modules/jobs/background-jobs.module';
import { CommunityModule } from './modules/community/community.module';
import { FloorPlanModule } from './modules/floor-plan/floor-plan.module';
import { LibrariesModule } from './modules/libraries/libraries.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
      envFilePath: ['.env', '../../.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => getControlPlaneTypeOrmConfig(configService),
    }),
    ControlPlaneModule,
    TenantConnectionModule,
    AuthModule,
    OrganizationsModule,
    LibrariesModule,
    CatalogModule,
    CirculationModule,
    AuditModule,
    NotificationsModule,
    WalletModule,
    FinesModule,
    BackgroundJobsModule,
    CommunityModule,
    FloorPlanModule,
    HealthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

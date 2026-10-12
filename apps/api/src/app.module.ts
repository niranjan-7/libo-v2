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
    CatalogModule,
    CirculationModule,
    HealthModule,
  ],
})
export class AppModule {}

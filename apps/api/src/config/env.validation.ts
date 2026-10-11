import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  API_PREFIX: string = '/api/v1';

  @IsString()
  @IsOptional()
  CORS_ORIGIN: string = 'http://localhost:5173';

  // Control Plane DB
  @IsString()
  CONTROL_PLANE_DB_HOST: string = 'localhost';

  @IsNumber()
  @IsOptional()
  CONTROL_PLANE_DB_PORT: number = 5432;

  @IsString()
  CONTROL_PLANE_DB_USER: string = 'postgres';

  @IsString()
  CONTROL_PLANE_DB_PASSWORD: string = 'postgres';

  @IsString()
  @IsOptional()
  CONTROL_PLANE_DB_NAME: string = 'control_plane_db';

  // Tenant DB Template
  @IsString()
  @IsOptional()
  TENANT_DB_HOST: string = 'localhost';

  @IsNumber()
  @IsOptional()
  TENANT_DB_PORT: number = 5432;

  @IsString()
  @IsOptional()
  TENANT_DB_USER: string = 'postgres';

  @IsString()
  @IsOptional()
  TENANT_DB_PASSWORD: string = 'postgres';

  @IsString()
  @IsOptional()
  TENANT_DB_TEMPLATE_NAME: string = 'tenant_template_db';

  // Security
  @IsString()
  @IsOptional()
  JWT_SECRET: string = 'dev_jwt_secret_minimum_32_characters_key_here';
}

export function validateEnvironment(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Environment validation error: ${errors.toString()}`);
  }

  return validatedConfig;
}

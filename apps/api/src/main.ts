import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cookieParser = require('cookie-parser');
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const prefix = configService.get<string>('API_PREFIX', '/api/v1');
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:5173');

  app.setGlobalPrefix(prefix.replace(/^\//, ''));

  app.use(cookieParser());

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Swagger OpenAPI Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Library Platform API')
    .setDescription(
      'Multi-tenant Library Platform API Documentation & Interactive Swagger Explorer.\n\n' +
      'Supports isolated tenant databases, social reading layer, 2D floor plans, circulation heatmaps, fine management, and wallet balance operations.',
    )
    .setVersion('2.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Provide your JWT authorization token (obtained via POST /api/v1/auth/login)',
        in: 'header',
      },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-organization-id',
        in: 'header',
        description: 'Multi-tenant Header: Active Organization ID',
      },
      'x-organization-id',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-library-id',
        in: 'header',
        description: 'Multi-tenant Header: Active Library ID',
      },
      'x-library-id',
    )
    .addTag('Auth', 'Authentication, user registration, login, and profile operations')
    .addTag('Organizations', 'Tenant organization lifecycle, memberships, and staff invitations')
    .addTag('Libraries', 'Library branches, access management, and global directory discovery')
    .addTag('Catalog', 'Book works, published editions, ISBN lookup, and physical copies')
    .addTag('Circulation', 'Circulation desk, borrowing, holds, active loans, and renewal')
    .addTag('Floor Plans', '2D floor plans, spatial racks, versioning, and circulation heatmaps')
    .addTag('Wallet', 'Digital wallet balances and simulated top-up transactions')
    .addTag('Fines', 'Overdue fines calculation, assessment, waiving, and settlement')
    .addTag('Community', 'Social reviews, ratings, comments, and book collections')
    .addTag('Notifications', 'In-app reader and staff notification delivery')
    .addTag('Audit', 'Immutable multi-tenant audit logs and event tracing')
    .addTag('Health', 'System diagnostics, database connectivity, and uptime telemetry')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Libo Platform API Swagger',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
    },
  });

  await app.listen(port);
  logger.log(`Library Platform API running on: http://localhost:${port}/${prefix.replace(/^\//, '')}`);
  logger.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
  logger.log(`Health endpoint available at: http://localhost:${port}/${prefix.replace(/^\//, '')}/health`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during API bootstrap:', err);
  process.exit(1);
});

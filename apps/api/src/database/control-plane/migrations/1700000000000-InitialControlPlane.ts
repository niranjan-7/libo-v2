import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialControlPlane1700000000000 implements MigrationInterface {
  name = 'InitialControlPlane1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Users
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "user_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" VARCHAR(255) NOT NULL UNIQUE,
        "password_hash" VARCHAR(255) NOT NULL,
        "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Organizations
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organizations" (
        "organization_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(255) NOT NULL,
        "slug" VARCHAR(100) NOT NULL UNIQUE,
        "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 3. Org Memberships
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "org_memberships" (
        "organization_id" UUID NOT NULL REFERENCES "organizations"("organization_id") ON DELETE CASCADE,
        "user_id" UUID NOT NULL REFERENCES "users"("user_id") ON DELETE CASCADE,
        "role" VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
        "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        "joined_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("organization_id", "user_id")
      );
    `);

    // 4. Org Invitations
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "org_invitations" (
        "invitation_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" UUID NOT NULL REFERENCES "organizations"("organization_id") ON DELETE CASCADE,
        "email" VARCHAR(255) NOT NULL,
        "proposed_role" VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
        "target_library_id" UUID NULL,
        "token_hash" VARCHAR(255) NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "accepted_at" TIMESTAMPTZ NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 5. Tenant Database Registry
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_database_registry" (
        "organization_id" UUID PRIMARY KEY REFERENCES "organizations"("organization_id") ON DELETE CASCADE,
        "database_key" VARCHAR(100) NOT NULL UNIQUE,
        "host" VARCHAR(255) NOT NULL,
        "port" INT NOT NULL DEFAULT 5432,
        "database_name" VARCHAR(100) NOT NULL,
        "secret_reference" VARCHAR(255) NOT NULL,
        "schema_version" VARCHAR(50) NOT NULL DEFAULT '1.0.0',
        "status" VARCHAR(50) NOT NULL DEFAULT 'HEALTHY',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 6. Control Plane Audit Logs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "control_plane_audit_logs" (
        "audit_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" UUID NOT NULL REFERENCES "organizations"("organization_id") ON DELETE CASCADE,
        "actor_user_id" UUID NOT NULL REFERENCES "users"("user_id") ON DELETE CASCADE,
        "action" VARCHAR(100) NOT NULL,
        "metadata" JSONB NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "control_plane_audit_logs";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_database_registry";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "org_invitations";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "org_memberships";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organizations";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
  }
}

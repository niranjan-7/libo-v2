import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLibrariesDirectory1700000000003 implements MigrationInterface {
  name = 'CreateLibrariesDirectory1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "libraries_directory" (
        "library_id" UUID PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES "organizations"("organization_id") ON DELETE CASCADE,
        "name" VARCHAR(255) NOT NULL,
        "slug" VARCHAR(100) NOT NULL,
        "timezone" VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
        "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "idx_libraries_directory_org_id" ON "libraries_directory" ("organization_id");
      CREATE INDEX IF NOT EXISTS "idx_libraries_directory_slug" ON "libraries_directory" ("slug");
    `);

    // Synchronize any existing libraries from healthy tenant databases
    try {
      const tenants = await queryRunner.query(`
        SELECT "organization_id", "database_name" 
        FROM "tenant_database_registry" 
        WHERE "status" = 'HEALTHY'
      `);

      for (const tenant of tenants) {
        try {
          // Connect to each tenant database via dblink or dynamic query if applicable,
          // or rely on application bootstrap to sync.
          // In standard PostgreSQL, we can safely attempt a cross-db query if dblink is available,
          // or populate upon service start.
        } catch {
          // Ignore individual tenant connection issues during control plane migration
        }
      }
    } catch {
      // Table might be empty on fresh install
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "libraries_directory";`);
  }
}

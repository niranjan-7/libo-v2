import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReaderAccessRequests1700000000002 implements MigrationInterface {
  name = 'CreateReaderAccessRequests1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reader_access_requests" (
        "request_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "library_id" UUID NOT NULL REFERENCES "libraries"("library_id") ON DELETE CASCADE,
        "user_id" UUID NOT NULL,
        "applicant_name" VARCHAR(255) NOT NULL,
        "applicant_email" VARCHAR(255) NOT NULL,
        "notes" TEXT NULL,
        "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        "reviewed_by_user_id" UUID NULL,
        "reviewed_at" TIMESTAMPTZ NULL,
        "rejection_reason" TEXT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS "idx_reader_access_requests_lib_user" 
        ON "reader_access_requests" ("library_id", "user_id");

      CREATE INDEX IF NOT EXISTS "idx_reader_access_requests_status" 
        ON "reader_access_requests" ("status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reader_access_requests";`);
  }
}

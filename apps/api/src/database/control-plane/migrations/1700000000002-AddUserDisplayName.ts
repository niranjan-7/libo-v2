import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserDisplayName1700000000002 implements MigrationInterface {
  name = 'AddUserDisplayName1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" VARCHAR(255) NOT NULL DEFAULT '';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "display_name";
    `);
  }
}

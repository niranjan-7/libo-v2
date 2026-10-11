import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialTenantSchema1700000000001 implements MigrationInterface {
  name = 'InitialTenantSchema1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Libraries (Strict Maximum of 3 per Organization)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "libraries" (
        "library_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(255) NOT NULL,
        "slug" VARCHAR(100) NOT NULL UNIQUE,
        "timezone" VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
        "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Race-safe trigger enforcing maximum 3 libraries using transaction advisory lock
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION check_library_limit() RETURNS TRIGGER AS $$
      DECLARE
        current_count INT;
      BEGIN
        PERFORM pg_advisory_xact_lock(hashtext('library_limit_lock'));
        SELECT COUNT(*) INTO current_count FROM "libraries";
        IF current_count >= 3 THEN
          RAISE EXCEPTION 'An organization cannot exceed the maximum limit of three libraries.';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS enforce_max_three_libraries ON "libraries";
      CREATE TRIGGER enforce_max_three_libraries
      BEFORE INSERT ON "libraries"
      FOR EACH ROW EXECUTE FUNCTION check_library_limit();
    `);

    // 2. Library Memberships
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "library_memberships" (
        "library_id" UUID NOT NULL REFERENCES "libraries"("library_id") ON DELETE CASCADE,
        "user_id" UUID NOT NULL,
        "role" VARCHAR(50) NOT NULL DEFAULT 'READER',
        "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        "joined_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("library_id", "user_id")
      );
    `);

    // 3. Reader Profiles
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reader_profiles" (
        "profile_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL UNIQUE,
        "display_name" VARCHAR(255) NOT NULL,
        "phone" VARCHAR(50) NULL,
        "address" TEXT NULL,
        "avatar_url" VARCHAR(500) NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 4. Library Settings (Independent per Branch)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "library_settings" (
        "library_id" UUID NOT NULL REFERENCES "libraries"("library_id") ON DELETE CASCADE,
        "setting_key" VARCHAR(100) NOT NULL,
        "value" JSONB NOT NULL,
        "updated_by_user_id" UUID NOT NULL,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("library_id", "setting_key")
      );
    `);

    // 5. System Audit Logs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "system_audit_logs" (
        "audit_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "library_id" UUID NULL REFERENCES "libraries"("library_id") ON DELETE SET NULL,
        "actor_user_id" UUID NOT NULL,
        "action" VARCHAR(100) NOT NULL,
        "entity_type" VARCHAR(100) NOT NULL,
        "entity_id" UUID NOT NULL,
        "old_value" JSONB NULL,
        "new_value" JSONB NULL,
        "trace_id" VARCHAR(100) NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 6. Authors
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "authors" (
        "author_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(255) NOT NULL,
        "biography" TEXT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 7. Publishers
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "publishers" (
        "publisher_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(255) NOT NULL UNIQUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 8. Books (Intellectual Works)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "books" (
        "book_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" VARCHAR(500) NOT NULL,
        "subtitle" VARCHAR(500) NULL,
        "synopsis" TEXT NULL,
        "cover_url" VARCHAR(500) NULL,
        "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 9. Book Authors
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "book_authors" (
        "book_id" UUID NOT NULL REFERENCES "books"("book_id") ON DELETE CASCADE,
        "author_id" UUID NOT NULL REFERENCES "authors"("author_id") ON DELETE CASCADE,
        PRIMARY KEY ("book_id", "author_id")
      );
    `);

    // 10. Categories
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categories" (
        "category_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(100) NOT NULL UNIQUE
      );
    `);

    // 11. Book Categories
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "book_categories" (
        "book_id" UUID NOT NULL REFERENCES "books"("book_id") ON DELETE CASCADE,
        "category_id" UUID NOT NULL REFERENCES "categories"("category_id") ON DELETE CASCADE,
        PRIMARY KEY ("book_id", "category_id")
      );
    `);

    // 12. Book Editions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "book_editions" (
        "edition_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "book_id" UUID NOT NULL REFERENCES "books"("book_id") ON DELETE CASCADE,
        "publisher_id" UUID NOT NULL REFERENCES "publishers"("publisher_id"),
        "isbn" VARCHAR(30) NULL,
        "edition_label" VARCHAR(100) NOT NULL DEFAULT 'Standard',
        "format" VARCHAR(50) NOT NULL DEFAULT 'Paperback',
        "language" VARCHAR(50) NOT NULL DEFAULT 'English',
        "publication_date" DATE NULL,
        "replacement_cost" NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 13. Library Floors
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "library_floors" (
        "floor_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "library_id" UUID NOT NULL REFERENCES "libraries"("library_id") ON DELETE CASCADE,
        "name" VARCHAR(100) NOT NULL,
        "floor_number" INT NOT NULL,
        "canvas_width" NUMERIC(10, 2) NOT NULL DEFAULT 1200.00,
        "canvas_height" NUMERIC(10, 2) NOT NULL DEFAULT 800.00,
        "coordinate_unit" VARCHAR(20) NOT NULL DEFAULT 'px',
        UNIQUE ("library_id", "floor_number")
      );
    `);

    // 14. Locations (Hierarchical: Zones, Racks, Shelves)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "locations" (
        "location_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "library_id" UUID NOT NULL REFERENCES "libraries"("library_id") ON DELETE CASCADE,
        "floor_id" UUID NOT NULL REFERENCES "library_floors"("floor_id") ON DELETE CASCADE,
        "parent_location_id" UUID NULL REFERENCES "locations"("location_id") ON DELETE CASCADE,
        "location_type" VARCHAR(50) NOT NULL,
        "code" VARCHAR(100) NOT NULL,
        "name" VARCHAR(100) NOT NULL,
        UNIQUE ("library_id", "code")
      );
    `);

    // 15. Book Copies (Physical Items)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "book_copies" (
        "copy_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "library_id" UUID NOT NULL REFERENCES "libraries"("library_id") ON DELETE CASCADE,
        "edition_id" UUID NOT NULL REFERENCES "book_editions"("edition_id") ON DELETE RESTRICT,
        "barcode" VARCHAR(100) NOT NULL,
        "status" VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
        "condition" VARCHAR(50) NOT NULL DEFAULT 'GOOD',
        "home_location_id" UUID NOT NULL REFERENCES "locations"("location_id"),
        "current_location_id" UUID NULL REFERENCES "locations"("location_id"),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("library_id", "barcode")
      );
    `);

    // 16. Floor Plan Versions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "floor_plan_versions" (
        "version_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "floor_id" UUID NOT NULL REFERENCES "library_floors"("floor_id") ON DELETE CASCADE,
        "version_number" INT NOT NULL,
        "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
        "created_by_user_id" UUID NOT NULL,
        "published_at" TIMESTAMPTZ NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("floor_id", "version_number")
      );
    `);

    // 17. Spatial Layouts (Visual Fixtures)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "spatial_layouts" (
        "element_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "version_id" UUID NOT NULL REFERENCES "floor_plan_versions"("version_id") ON DELETE CASCADE,
        "linked_location_id" UUID NULL REFERENCES "locations"("location_id") ON DELETE SET NULL,
        "element_type" VARCHAR(50) NOT NULL,
        "x" NUMERIC(10, 2) NOT NULL,
        "y" NUMERIC(10, 2) NOT NULL,
        "width" NUMERIC(10, 2) NOT NULL,
        "height" NUMERIC(10, 2) NOT NULL,
        "rotation" NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
        "z_index" INT NOT NULL DEFAULT 0,
        "properties" JSONB NOT NULL DEFAULT '{}'
      );
    `);

    // 18. Reservations
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reservations" (
        "reservation_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "library_id" UUID NOT NULL REFERENCES "libraries"("library_id") ON DELETE CASCADE,
        "reader_user_id" UUID NOT NULL,
        "edition_id" UUID NOT NULL REFERENCES "book_editions"("edition_id"),
        "assigned_copy_id" UUID NULL REFERENCES "book_copies"("copy_id") ON DELETE SET NULL,
        "status" VARCHAR(50) NOT NULL DEFAULT 'WAITLISTED',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "allocated_at" TIMESTAMPTZ NULL,
        "ready_at" TIMESTAMPTZ NULL,
        "pickup_deadline_at" TIMESTAMPTZ NULL,
        "fulfilled_at" TIMESTAMPTZ NULL,
        "cancelled_at" TIMESTAMPTZ NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "idx_unique_active_reservation_per_reader" 
      ON "reservations"("library_id", "reader_user_id", "edition_id") 
      WHERE "status" IN ('WAITLISTED', 'ALLOCATED', 'READY_FOR_PICKUP');

      CREATE UNIQUE INDEX IF NOT EXISTS "idx_unique_copy_active_reservation" 
      ON "reservations"("assigned_copy_id") 
      WHERE "status" IN ('ALLOCATED', 'READY_FOR_PICKUP') AND "assigned_copy_id" IS NOT NULL;
    `);

    // 19. Loans
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "loans" (
        "loan_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "library_id" UUID NOT NULL REFERENCES "libraries"("library_id") ON DELETE CASCADE,
        "copy_id" UUID NOT NULL REFERENCES "book_copies"("copy_id") ON DELETE RESTRICT,
        "reader_user_id" UUID NOT NULL,
        "reservation_id" UUID NULL UNIQUE REFERENCES "reservations"("reservation_id") ON DELETE SET NULL,
        "checked_out_by_user_id" UUID NOT NULL,
        "checked_out_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "due_at" TIMESTAMPTZ NOT NULL,
        "returned_at" TIMESTAMPTZ NULL,
        "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        "extension_count" INT NOT NULL DEFAULT 0,
        "policy_snapshot" JSONB NOT NULL DEFAULT '{}'
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "idx_unique_active_loan_per_copy" 
      ON "loans"("copy_id") 
      WHERE "status" IN ('ACTIVE', 'OVERDUE');
    `);

    // 20. Wallets (Independent per Library)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wallets" (
        "wallet_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "library_id" UUID NOT NULL REFERENCES "libraries"("library_id") ON DELETE CASCADE,
        "user_id" UUID NOT NULL,
        "currency_code" VARCHAR(10) NOT NULL DEFAULT 'INR',
        "balance_cache" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("library_id", "user_id")
      );
    `);

    // 21. Fines
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fines" (
        "fine_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "library_id" UUID NOT NULL REFERENCES "libraries"("library_id") ON DELETE CASCADE,
        "reader_user_id" UUID NOT NULL,
        "loan_id" UUID NULL REFERENCES "loans"("loan_id") ON DELETE SET NULL,
        "fine_type" VARCHAR(50) NOT NULL,
        "fine_date" DATE NULL,
        "amount" NUMERIC(10, 2) NOT NULL,
        "outstanding_amount" NUMERIC(10, 2) NOT NULL,
        "status" VARCHAR(50) NOT NULL DEFAULT 'UNPAID',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "idx_unique_daily_overdue_fine" 
      ON "fines"("loan_id", "fine_date", "fine_type") 
      WHERE "fine_date" IS NOT NULL;
    `);

    // 22. Wallet Transactions (Append-Only Ledger)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wallet_transactions" (
        "transaction_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "wallet_id" UUID NOT NULL REFERENCES "wallets"("wallet_id") ON DELETE CASCADE,
        "fine_id" UUID NULL REFERENCES "fines"("fine_id") ON DELETE SET NULL,
        "loan_id" UUID NULL REFERENCES "loans"("loan_id") ON DELETE SET NULL,
        "transaction_type" VARCHAR(50) NOT NULL,
        "direction" VARCHAR(10) NOT NULL,
        "amount" NUMERIC(10, 2) NOT NULL,
        "currency_code" VARCHAR(10) NOT NULL DEFAULT 'INR',
        "idempotency_key" VARCHAR(255) NOT NULL UNIQUE,
        "notes" TEXT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 23. Notifications
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "notification_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL,
        "library_id" UUID NULL REFERENCES "libraries"("library_id") ON DELETE SET NULL,
        "event_type" VARCHAR(100) NOT NULL,
        "title" VARCHAR(255) NOT NULL,
        "body" TEXT NOT NULL,
        "payload" JSONB NOT NULL DEFAULT '{}',
        "dedupe_key" VARCHAR(255) NOT NULL UNIQUE,
        "read_at" TIMESTAMPTZ NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 24. Notification Deliveries
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_deliveries" (
        "delivery_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "notification_id" UUID NOT NULL REFERENCES "notifications"("notification_id") ON DELETE CASCADE,
        "channel" VARCHAR(50) NOT NULL,
        "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        "attempt_count" INT NOT NULL DEFAULT 0,
        "sent_at" TIMESTAMPTZ NULL,
        "error_message" TEXT NULL
      );
    `);

    // 25. Reviews
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reviews" (
        "review_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL,
        "book_id" UUID NOT NULL REFERENCES "books"("book_id") ON DELETE CASCADE,
        "rating" INT NOT NULL CHECK ("rating" >= 1 AND "rating" <= 5),
        "title" VARCHAR(255) NOT NULL,
        "body" TEXT NOT NULL,
        "status" VARCHAR(50) NOT NULL DEFAULT 'PUBLISHED',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("user_id", "book_id")
      );
    `);

    // 26. Review Votes
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "review_votes" (
        "review_id" UUID NOT NULL REFERENCES "reviews"("review_id") ON DELETE CASCADE,
        "user_id" UUID NOT NULL,
        "vote_value" INT NOT NULL CHECK ("vote_value" IN (1, -1)),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("review_id", "user_id")
      );
    `);

    // 27. Review Comments
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "review_comments" (
        "comment_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "review_id" UUID NOT NULL REFERENCES "reviews"("review_id") ON DELETE CASCADE,
        "user_id" UUID NOT NULL,
        "body" TEXT NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 28. Collections
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "collections" (
        "collection_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "creator_user_id" UUID NOT NULL,
        "title" VARCHAR(255) NOT NULL,
        "description" TEXT NULL,
        "visibility" VARCHAR(50) NOT NULL DEFAULT 'PUBLIC',
        "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 29. Collection Books
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "collection_books" (
        "collection_id" UUID NOT NULL REFERENCES "collections"("collection_id") ON DELETE CASCADE,
        "book_id" UUID NOT NULL REFERENCES "books"("book_id") ON DELETE CASCADE,
        "position" INT NOT NULL,
        PRIMARY KEY ("collection_id", "book_id"),
        UNIQUE ("collection_id", "position")
      );
    `);

    // 30. Badges
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "badges" (
        "badge_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" VARCHAR(100) NOT NULL UNIQUE,
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT NOT NULL,
        "criteria" JSONB NOT NULL DEFAULT '{}'
      );
    `);

    // 31. Reader Badges
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reader_badges" (
        "user_id" UUID NOT NULL,
        "badge_id" UUID NOT NULL REFERENCES "badges"("badge_id") ON DELETE CASCADE,
        "earned_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("user_id", "badge_id")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reader_badges";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "badges";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "collection_books";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "collections";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "review_comments";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "review_votes";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reviews";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_deliveries";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_transactions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fines";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wallets";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "loans";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reservations";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "spatial_layouts";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "floor_plan_versions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "book_copies";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "locations";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "library_floors";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "book_editions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "book_categories";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "book_authors";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "books";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "publishers";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "authors";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "system_audit_logs";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "library_settings";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reader_profiles";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "library_memberships";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "libraries";`);
  }
}

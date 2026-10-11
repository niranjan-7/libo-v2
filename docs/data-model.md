# Library Platform — Data Model & Schema Specification

## 1. Schema Architecture Overview

The database design cleanly separates the central identity and routing control plane from the organization tenant databases.

- **Control-Plane Database:** 6 tables (`users`, `organizations`, `org_memberships`, `org_invitations`, `tenant_database_registry`, `control_plane_audit_logs`).
- **Tenant Database:** 31 tables grouped into 5 bounded domains:
  1. Library Core & Access (5 tables)
  2. Catalog & Physical Inventory (12 tables)
  3. Circulation & State Machines (2 tables)
  4. Financials & Independent Wallets (3 tables)
  5. Notifications & Social Reading (9 tables)

---

## 2. Control-Plane Database Schema (6 Tables)

```sql
-- 1. Global Users (Central Identity)
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Organizations
CREATE TABLE organizations (
    organization_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Organization Memberships
CREATE TABLE org_memberships (
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- OWNER, ADMIN, MEMBER
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, user_id)
);

-- 4. Organization Invitations
CREATE TABLE org_invitations (
    invitation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    proposed_role VARCHAR(50) NOT NULL, -- ADMIN, MEMBER
    target_library_id UUID NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Tenant Database Registry
CREATE TABLE tenant_database_registry (
    organization_id UUID PRIMARY KEY REFERENCES organizations(organization_id) ON DELETE CASCADE,
    database_key VARCHAR(100) NOT NULL UNIQUE,
    host VARCHAR(255) NOT NULL,
    port INT NOT NULL DEFAULT 5432,
    database_name VARCHAR(100) NOT NULL,
    secret_reference VARCHAR(255) NOT NULL, -- KMS / Vault key reference
    schema_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    status VARCHAR(50) NOT NULL DEFAULT 'HEALTHY', -- PROVISIONING, HEALTHY, MIGRATING
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Control Plane Audit Logs
CREATE TABLE control_plane_audit_logs (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    actor_user_id UUID NOT NULL REFERENCES users(user_id),
    action VARCHAR(100) NOT NULL, -- ORG_CREATED, ROLE_CHANGED, OWNER_TRANSFERRED
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 3. Tenant Database Schema (31 Tables)

### Domain 1: Library Access, Profiles & Settings (5 Tables)

```sql
-- 1. Libraries (Strict Maximum of 3 per Organization)
CREATE TABLE libraries (
    library_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce maximum 3 libraries per tenant database
CREATE OR REPLACE FUNCTION check_library_limit() RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM libraries) >= 3 THEN
        RAISE EXCEPTION 'An organization cannot exceed the maximum limit of three libraries.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_max_three_libraries
BEFORE INSERT ON libraries
FOR EACH ROW EXECUTE FUNCTION check_library_limit();

-- 2. Library Memberships (Access per Branch)
CREATE TABLE library_memberships (
    library_id UUID NOT NULL REFERENCES libraries(library_id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- Validated UUID from control plane
    role VARCHAR(50) NOT NULL, -- READER, LIBRARIAN
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (library_id, user_id)
);

-- 3. Reader Profiles
CREATE TABLE reader_profiles (
    profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NULL,
    address TEXT NULL,
    avatar_url VARCHAR(500) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Library Settings (Independent per Library Branch)
CREATE TABLE library_settings (
    library_id UUID NOT NULL REFERENCES libraries(library_id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    updated_by_user_id UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (library_id, setting_key)
);

-- 5. System Audit Logs
CREATE TABLE system_audit_logs (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NULL REFERENCES libraries(library_id) ON DELETE SET NULL,
    actor_user_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    old_value JSONB NULL,
    new_value JSONB NULL,
    trace_id VARCHAR(100) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Domain 2: Book Catalog & Physical Inventory (12 Tables)

```sql
-- 6. Authors
CREATE TABLE authors (
    author_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    biography TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Publishers
CREATE TABLE publishers (
    publisher_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Books (Intellectual Works)
CREATE TABLE books (
    book_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    subtitle VARCHAR(500) NULL,
    synopsis TEXT NULL,
    cover_url VARCHAR(500) NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Book Authors (Many-to-Many)
CREATE TABLE book_authors (
    book_id UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES authors(author_id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, author_id)
);

-- 10. Categories
CREATE TABLE categories (
    category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE
);

-- 11. Book Categories (Many-to-Many)
CREATE TABLE book_categories (
    book_id UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, category_id)
);

-- 12. Book Editions (Published Formats)
CREATE TABLE book_editions (
    edition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    publisher_id UUID NOT NULL REFERENCES publishers(publisher_id),
    isbn VARCHAR(30) NULL,
    edition_label VARCHAR(100) NOT NULL DEFAULT 'Standard',
    format VARCHAR(50) NOT NULL, -- Paperback, Hardcover, E-Book
    language VARCHAR(50) NOT NULL DEFAULT 'English',
    publication_date DATE NULL,
    replacement_cost NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Library Floors
CREATE TABLE library_floors (
    floor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(library_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    floor_number INT NOT NULL,
    canvas_width NUMERIC(10, 2) NOT NULL DEFAULT 1200.00,
    canvas_height NUMERIC(10, 2) NOT NULL DEFAULT 800.00,
    coordinate_unit VARCHAR(20) NOT NULL DEFAULT 'px',
    UNIQUE (library_id, floor_number)
);

-- 14. Locations (Hierarchical: Zones, Racks, Shelves)
CREATE TABLE locations (
    location_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(library_id) ON DELETE CASCADE,
    floor_id UUID NOT NULL REFERENCES library_floors(floor_id) ON DELETE CASCADE,
    parent_location_id UUID NULL REFERENCES locations(location_id) ON DELETE CASCADE,
    location_type VARCHAR(50) NOT NULL, -- ZONE, RACK, SHELF, SERVICE_DESK, RETURNS_DESK
    code VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    UNIQUE (library_id, code)
);

-- 15. Book Copies (Physical Items)
CREATE TABLE book_copies (
    copy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(library_id) ON DELETE CASCADE,
    edition_id UUID NOT NULL REFERENCES book_editions(edition_id) ON DELETE RESTRICT,
    barcode VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, ON_HOLD, LOANED, LOST, DAMAGED, WITHDRAWN
    condition VARCHAR(50) NOT NULL DEFAULT 'GOOD',   -- NEW, GOOD, MINOR_WEAR, DAMAGED
    home_location_id UUID NOT NULL REFERENCES locations(location_id),
    current_location_id UUID NULL REFERENCES locations(location_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (library_id, barcode)
);

-- 16. Floor Plan Versions
CREATE TABLE floor_plan_versions (
    version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    floor_id UUID NOT NULL REFERENCES library_floors(floor_id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', -- DRAFT, PUBLISHED, ARCHIVED
    created_by_user_id UUID NOT NULL,
    published_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (floor_id, version_number)
);

-- 17. Spatial Layouts (Visual Fixtures)
CREATE TABLE spatial_layouts (
    element_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES floor_plan_versions(version_id) ON DELETE CASCADE,
    linked_location_id UUID NULL REFERENCES locations(location_id) ON DELETE SET NULL,
    element_type VARCHAR(50) NOT NULL, -- RACK, WALL, DOOR, DESK, ENTRANCE, STAIRS, ELEVATOR, PICKUP_AREA
    x NUMERIC(10, 2) NOT NULL,
    y NUMERIC(10, 2) NOT NULL,
    width NUMERIC(10, 2) NOT NULL,
    height NUMERIC(10, 2) NOT NULL,
    rotation NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    z_index INT NOT NULL DEFAULT 0,
    properties JSONB NOT NULL DEFAULT '{}'
);
```

### Domain 3: Circulation & State Machines (2 Tables)

```sql
-- 18. Reservations
CREATE TABLE reservations (
    reservation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(library_id) ON DELETE CASCADE,
    reader_user_id UUID NOT NULL,
    edition_id UUID NOT NULL REFERENCES book_editions(edition_id),
    assigned_copy_id UUID NULL REFERENCES book_copies(copy_id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'WAITLISTED', -- WAITLISTED, ALLOCATED, READY_FOR_PICKUP, FULFILLED, EXPIRED, CANCELLED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    allocated_at TIMESTAMPTZ NULL,
    ready_at TIMESTAMPTZ NULL,
    pickup_deadline_at TIMESTAMPTZ NULL,
    fulfilled_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL
);

-- Unique index ensuring at most 1 active hold per reader/edition at that library
CREATE UNIQUE INDEX idx_unique_active_reservation_per_reader 
ON reservations(library_id, reader_user_id, edition_id) 
WHERE status IN ('WAITLISTED', 'ALLOCATED', 'READY_FOR_PICKUP');

-- Unique index ensuring an assigned copy is linked to at most 1 active hold
CREATE UNIQUE INDEX idx_unique_copy_active_reservation 
ON reservations(assigned_copy_id) 
WHERE status IN ('ALLOCATED', 'READY_FOR_PICKUP') AND assigned_copy_id IS NOT NULL;

-- 19. Loans
CREATE TABLE loans (
    loan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(library_id) ON DELETE CASCADE,
    copy_id UUID NOT NULL REFERENCES book_copies(copy_id) ON DELETE RESTRICT,
    reader_user_id UUID NOT NULL,
    reservation_id UUID NULL UNIQUE REFERENCES reservations(reservation_id) ON DELETE SET NULL,
    checked_out_by_user_id UUID NOT NULL,
    checked_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_at TIMESTAMPTZ NOT NULL,
    returned_at TIMESTAMPTZ NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, RETURNED, OVERDUE, LOST
    extension_count INT NOT NULL DEFAULT 0,
    policy_snapshot JSONB NOT NULL DEFAULT '{}'
);

-- Unique index ensuring at most 1 active loan per physical copy
CREATE UNIQUE INDEX idx_unique_active_loan_per_copy 
ON loans(copy_id) 
WHERE status IN ('ACTIVE', 'OVERDUE');
```

### Domain 4: Financials & Independent Library Wallets (3 Tables)

```sql
-- 20. Library-Specific Wallets (Isolated per Branch)
CREATE TABLE wallets (
    wallet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(library_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    currency_code VARCHAR(10) NOT NULL DEFAULT 'INR',
    balance_cache NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (library_id, user_id)
);

-- 21. Fines (Liability Records)
CREATE TABLE fines (
    fine_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES libraries(library_id) ON DELETE CASCADE,
    reader_user_id UUID NOT NULL,
    loan_id UUID NULL REFERENCES loans(loan_id) ON DELETE SET NULL,
    fine_type VARCHAR(50) NOT NULL, -- OVERDUE_DAILY, LOST_ITEM, DAMAGE_FEE, MANUAL_CHARGE
    fine_date DATE NULL,
    amount NUMERIC(10, 2) NOT NULL,
    outstanding_amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'UNPAID', -- UNPAID, PARTIALLY_PAID, PAID, WAIVED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index preventing duplicate daily fine for same loan and date
CREATE UNIQUE INDEX idx_unique_daily_overdue_fine 
ON fines(loan_id, fine_date, fine_type) 
WHERE fine_date IS NOT NULL;

-- 22. Wallet Transactions (Append-Only Ledger)
CREATE TABLE wallet_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(wallet_id) ON DELETE CASCADE,
    fine_id UUID NULL REFERENCES fines(fine_id) ON DELETE SET NULL,
    loan_id UUID NULL REFERENCES loans(loan_id) ON DELETE SET NULL,
    transaction_type VARCHAR(50) NOT NULL, -- TOPUP, EXTENSION_FEE, FINE_SETTLEMENT, MANUAL_ADJUSTMENT
    direction VARCHAR(10) NOT NULL,        -- CREDIT, DEBIT
    amount NUMERIC(10, 2) NOT NULL,
    currency_code VARCHAR(10) NOT NULL DEFAULT 'INR',
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Domain 5: Notifications & Social Reading (9 Tables)

```sql
-- 23. Notifications
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    library_id UUID NULL REFERENCES libraries(library_id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    dedupe_key VARCHAR(255) NOT NULL UNIQUE,
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 24. Notification Deliveries
CREATE TABLE notification_deliveries (
    delivery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(notification_id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL, -- IN_APP, EMAIL
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, SENT, FAILED
    attempt_count INT NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ NULL,
    error_message TEXT NULL
);

-- 25. Reviews
CREATE TABLE reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    book_id UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PUBLISHED', -- PUBLISHED, REPORTED, IN_REVIEW, REMOVED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, book_id)
);

-- 26. Review Votes
CREATE TABLE review_votes (
    review_id UUID NOT NULL REFERENCES reviews(review_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    vote_value INT NOT NULL CHECK (vote_value IN (1, -1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (review_id, user_id)
);

-- 27. Review Comments
CREATE TABLE review_comments (
    comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(review_id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 28. Collections
CREATE TABLE collections (
    collection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    visibility VARCHAR(50) NOT NULL DEFAULT 'PUBLIC', -- PUBLIC, PRIVATE
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 29. Collection Books
CREATE TABLE collection_books (
    collection_id UUID NOT NULL REFERENCES collections(collection_id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
    position INT NOT NULL,
    PRIMARY KEY (collection_id, book_id),
    UNIQUE (collection_id, position)
);

-- 30. Badges
CREATE TABLE badges (
    badge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    criteria JSONB NOT NULL DEFAULT '{}'
);

-- 31. Reader Badges
CREATE TABLE reader_badges (
    user_id UUID NOT NULL,
    badge_id UUID NOT NULL REFERENCES badges(badge_id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, badge_id)
);
```

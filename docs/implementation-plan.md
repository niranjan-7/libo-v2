# Library Platform — Implementation Plan & Milestone Tracker

## 1. Plan Overview

The implementation follows a production-minded incremental sequence covering the full scope. Each milestone delivers working code, migrations, tests, and verifiable acceptance criteria before moving forward.

```
[Milestone 1: Core Infra & Auth] ──> [Milestone 2: Catalog & Inventory] ──> [Milestone 3: Circulation & State Machine]
                                                                                │
[Milestone 6: Social & Auditing] <── [Milestone 5: Wallets & Fines] <── [Milestone 4: 2D Spatial Floor-Plan Engine]
          │
[Milestone 7: Reference Fidelity & E2E Verification]
```

---

## 2. Milestone Details & Status

### Milestone 1: Monorepo Setup, Control Plane DB, Auth & Tenant DB Provisioning
- **Status:** Pending Review / Ready for Execution
- **Intended Files:**
  - `package.json`, `pnpm-workspace.yaml`, `.env.example`, `infra/docker-compose.yml`
  - `packages/contracts/`: Shared DTOs (`UserDto`, `OrgDto`, `AuthTokens`, roles, enums)
  - `apps/api/`: NestJS core, TypeORM dual-datasource setup, control-plane migrations (`users`, `organizations`, `org_memberships`, `org_invitations`, `tenant_database_registry`, `control_plane_audit_logs`)
  - `TenantConnectionService`: Dynamic connection pool management and tenant DB provisioning
  - `apps/web/`: React 18 + Vite + TypeScript application shell with token styling from `library_platform_interactive_prototype_v2.html`
- **Acceptance Criteria:**
  1. PostgreSQL starts with `control_plane_db`.
  2. Registration, login, and `/api/v1/auth/me` return authenticated profile with JWT cookie.
  3. Organization creation provisions a new isolated PostgreSQL tenant DB, executes tenant template migrations, and registers the connection in `tenant_database_registry`.
  4. Attempting to create a 4th library inside an organization is rejected by both application logic and database constraint.
- **Tests:** Unit tests on password hashing and JWT issuance; Integration tests on tenant DB creation and the 3-library limit trigger.

---

### Milestone 2: Book Catalog, Location Hierarchy & Physical Barcodes
- **Status:** Queued
- **Intended Files:** `CatalogModule` (Books, Editions, Authors, Categories), `InventoryModule` (Floors, Locations, Copies).
- **Acceptance Criteria:**
  1. Create works and editions with ISBNs and replacement costs.
  2. Define hierarchical locations (`Zone` → `Rack` → `Shelf`).
  3. Register physical copies with unique barcodes and home locations; bulk barcode intake parses multi-line inputs.
- **Tests:** Faceted search tests; unique barcode constraint tests; location hierarchy parent-child constraint tests.

---

### Milestone 3: Circulation Engine & Reservation State Machine
- **Status:** Queued
- **Intended Files:** `CirculationModule`, `ReservationModule`, concurrency row-lock services.
- **Acceptance Criteria:**
  1. Reserve an edition moves through `WAITLISTED` → `ALLOCATED` → `READY_FOR_PICKUP`.
  2. Barcode checkout verifies hold or performs walk-in checkout; marks copy `LOANED` in one atomic transaction.
  3. Returns update loan status and automatically reallocate copy to the oldest waitlisted hold if present.
- **Tests:** Concurrency test simulating simultaneous reserve requests for the last physical copy; checkout transaction rollback test.

---

### Milestone 4: Spatial 2D Floor-Plan Engine & Reader Map
- **Status:** Queued
- **Intended Files:** `SpatialModule`, React SVG/Canvas interactive floor plan builder & viewer components.
- **Acceptance Criteria:**
  1. Drag/resize fixtures (racks, desks, walls); link visual rack elements to logical `Locations`.
  2. Validator flags unlinked racks or overlapping fixtures before publishing.
  3. Reader map displays highlighted racks with available copies; rack selection opens shelf-by-shelf view with live counts.
- **Tests:** Draft/publish state validation tests; layout JSON serialization/deserialization tests.

---

### Milestone 5: Independent Library Wallets, Fines & Background Workers
- **Status:** Queued
- **Intended Files:** `FinanceModule`, `NotificationModule`, BullMQ / scheduled workers.
- **Acceptance Criteria:**
  1. Simulated wallet top-ups (`₹100`, `₹250`, `₹500`) credit the append-only ledger.
  2. Overdue background worker calculates local overdue days and creates fines with unique `(loan_id, fine_date)` keys.
  3. Paid renewals are rejected if wallet balance is insufficient.
  4. Wallets between Library 1 and Library 2 remain completely isolated.
- **Tests:** Idempotency test asserting worker runs twice on the same day without duplicating charges; wallet debit race condition test.

---

### Milestone 6: Social Reading, Moderation & Audit Trails
- **Status:** Queued
- **Intended Files:** `SocialModule`, `AuditModule`, review moderation and badge award engine.
- **Acceptance Criteria:**
  1. Publish review enforces 7-day holding duration eligibility; upvote/downvote updates derive counts safely.
  2. Curated collection creation unlocks only after reader completes 20 distinct book titles.
  3. Admin moderation panel allows reviewing flagged reviews with mandatory audit log reason.
- **Tests:** Review eligibility gate test; voting idempotency test; curation unlock threshold calculation test.

---

### Milestone 7: Visual Polish, Theme Controls & End-to-End Verification
- **Status:** Queued
- **Intended Files:** Final React component styling, dark mode tokens, Playwright test suite.
- **Acceptance Criteria:**
  1. Pixel-accurate recreation of all 30 prototype screens matching `library_platform_interactive_prototype_v2.html`.
  2. Appearance drawer switches theme presets (Editorial, Soft cards, Crisp) and toggles dark mode smoothly.
  3. Complete Playwright E2E test runs successfully from registration to reservation, pickup, checkout, and return.

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

### Milestone 1: Monorepo Scaffold, Control Plane DB Configuration & Connectivity Probe
- **Status:** COMPLETED & VERIFIED
- **Implemented Artifacts:**
  - `package.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `infra/docker-compose.yml`, `infra/init-scripts/01-init-databases.sql`
  - `packages/contracts/`: Shared DTOs (`HealthResponse`, `UserDto`, `OrganizationDto`), Enums (`OrgRole`, `LibraryRole`, `CopyStatus`, `ReservationStatus`, `LoanStatus`, `FineStatus`, `FineType`, `WalletTransactionType`)
  - `apps/api/`: NestJS 10 backend with TypeORM persistence, Environment validation (`class-validator`), Control Plane entities (`users`, `organizations`, `org_memberships`, `org_invitations`, `tenant_database_registry`, `control_plane_audit_logs`), Initial migration (`1700000000000-InitialControlPlane.ts`), HealthModule with `/api/v1/health`, `/api/v1/health/ready`, `/api/v1/health/live`, and dynamic `TenantConnectionService`
  - `apps/web/`: React 18 + Vite + TypeScript application with design tokens from `library_platform_interactive_prototype_v2.html` and real-time `ConnectivityBanner` probing the backend
  - Root `README.md`: Documenting start, stop, reset, and test procedures
- **Validation Commands Executed & Passed:**
  - `npm run typecheck`: Passed across `@library/contracts`, `@library/api`, and `@library/web` (exit code 0).
  - `npm run build`: Passed across all packages and apps (exit code 0).
  - `npm run test`: Passed across all packages with unit test coverage on `HealthService` (3 tests passed, exit code 0).
  - `npm run lint`: Passed across all workspaces (exit code 0).


### Milestone 2: Multi-Tenant Database Foundation & Isolation Engine
- **Status:** COMPLETED & VERIFIED
- **Implemented Artifacts:**
  - `apps/api/src/database/control-plane/migrations/1700000000000-InitialControlPlane.ts`: 6 control plane tables (`users`, `organizations`, `org_memberships`, `org_invitations`, `tenant_database_registry`, `control_plane_audit_logs`).
  - `apps/api/src/database/tenant/migrations/1700000000001-InitialTenantSchema.ts`: Complete tenant schema comprising 31 tables across all 5 domains, with unique constraints, partial indexes, and race-safe `check_library_limit()` trigger using `pg_advisory_xact_lock`.
  - `TenantDatabaseRegistryService`: Safe database provisioning (`tenant_<slug>_<idPrefix>`), automated migration execution, and fleet runner.
  - `TenantConnectionService`: Dynamic pooled DataSource manager with bounded LRU cache (50 pools), 10-minute idle eviction, and safe organization ID resolution.
  - `ControlPlaneModule`: Global NestJS module providing registry and repository access.
- **Validation Commands Executed & Passed:**
  - `npm run migration:run --workspace=@library/api`: Applied Control-Plane migration to `control_plane_db`.
  - `npm run test:integration --workspace=@library/api`: 4/4 integration tests passed:
    1. Provision separate tenant databases and apply migrations reproducibly.
    2. Strict tenant isolation (Library created in Tenant Alpha is completely invisible in Tenant Beta).
    3. Rejection of unmapped/unregistered organization IDs.
    4. Race-safe enforcement of maximum 3 libraries per organization (4th attempt rejected, concurrent simultaneous attempts all blocked).
  - `npm run typecheck`, `npm run build`, `npm run test`: All passed with exit code 0.

---

### Milestone 3: End-to-End Vertical Slice & Onboarding
- **Status:** COMPLETED & VERIFIED
- **Implemented Artifacts:**
  - `apps/api/src/modules/auth/`: Register, login, current-user endpoints, bcrypt password hashing, JWT cookies.
  - `apps/api/src/modules/organizations/`: Organization creation, automated tenant database provisioning, initial library creation, membership listing, invitations.
  - `apps/web/src/components/AuthScreen.tsx`: Complete authentication and onboarding modal.
  - `apps/web/src/components/DashboardShell.tsx`: Role-aware navigation shell with multi-branch switcher.
- **Validation:** `vertical-slice.integration.spec.ts` (14 integration tests passing).

---

### Milestone 4: Modern Design System & Reusable Component Library
- **Status:** COMPLETED & VERIFIED
- **Implemented Artifacts:**
  - `apps/web/src/components/common/`: Typography, Buttons, Inputs, Dialogs, Cards, Book Cards, Status Pills, Tables, Tabs, SideNav, TopNav.
  - `apps/web/src/context/ThemeContext.tsx`: Token system supporting 3 style presets (Editorial, Soft Cards, Crisp) and Dark Mode.
  - Fully responsive layout across mobile and desktop breakpoints without iframe embedding.

---

### Milestone 5: Book Catalog, Hierarchical Locations & Physical Inventory
- **Status:** COMPLETED & VERIFIED
- **Implemented Artifacts:**
  - `apps/api/src/modules/catalog/`: Works, Editions, Copies, Authors, Publishers, Categories, Logical Racks/Shelves.
  - `apps/web/src/components/catalog/`: Catalog search, faceted filters, book detail modal with edition selector, inventory tracking.
- **Validation:** `catalog-inventory.integration.spec.ts` (10 integration tests passing).

---

### Milestone 6: Circulation Engine, Concurrency Controls & Hold Queue
- **Status:** COMPLETED & VERIFIED
- **Implemented Artifacts:**
  - `apps/api/src/modules/circulation/`: Walk-in checkout, returns, 72h reservation pickup countdown, waitlist queue, renewal limits.
  - `apps/web/src/components/circulation/`: CirculationScreen, MyReservationsScreen.
- **Validation:** `circulation-loans.integration.spec.ts` (16 integration tests passing). Row-level `FOR UPDATE` concurrency locks verified.

---

### Milestone 7: Append-Only Wallet Ledger, Fines & Notifications
- **Status:** COMPLETED & VERIFIED
- **Implemented Artifacts:**
  - `apps/api/src/modules/wallet/`: Append-only `wallet_transactions`, simulated top-up, idempotency replay protection.
  - `apps/api/src/modules/fines/`: Daily overdue fine generation with unique daily keys, manual fines, fine waivers with audit logging.
  - `apps/api/src/modules/notifications/`: Notification inbox, delivery statuses, automated background sweep workers.
  - `apps/web/src/components/wallet/`: WalletScreen, simulated top-up drawer, fine payment dialog.
- **Validation:** `financials-notifications.integration.spec.ts` (16 integration tests passing).

---

### Milestone 8: Social Reading, Community Layer & Review Moderation
- **Status:** COMPLETED & VERIFIED
- **Implemented Artifacts:**
  - `apps/api/src/modules/community/`: Reviews, atomic upvote/downvote scores, curated collections, achievement badges, moderation.
  - `apps/web/src/components/community/`: CommunityScreen, ReviewCard, deep-link share modal.
- **Validation:** `community-reviews.integration.spec.ts` (12 integration tests passing).

---

### Milestone 9: Spatial 2D Floor-Plan Engine & Reader Map
- **Status:** COMPLETED & VERIFIED
- **Implemented Artifacts:**
  - `apps/api/src/modules/floor-plan/`: 2D SVG canvas editor, RACK/WALL/DOOR/DESK elements, draft/publish/restore versioning, logical rack linking.
  - `apps/web/src/components/floor-plan/`: FloorPlanEditor, FloorPlanReaderView with shelf inspection.
- **Validation:** `floor-plan-editor.integration.spec.ts` (6 integration tests passing).

---

### Milestone 10: Production Hardening, Admin Panels, Isolation Suite & Runbooks
- **Status:** COMPLETED & VERIFIED
- **Implemented Artifacts:**
  - `apps/web/src/components/admin/`: MembersScreen, BranchSettingsScreen, AnalyticsScreen telemetry stream.
  - `apps/api/src/database/cli/run-tenant-migrations.ts`: Operator CLI for fleet migrations.
  - `docs/deployment.md`, `docs/runbook.md`, `docs/environment-variables.md`, `docs/known-limitations.md`, `docs/feature-coverage.md`.
- **Validation:** `cross-tenant-isolation.integration.spec.ts` (10 integration tests passing). All 93 integration tests passing, zero credential leaks, `synchronize: false` enforced.

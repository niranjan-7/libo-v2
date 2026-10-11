# Library Platform — Product Requirements Document (PRD)

## 1. Product Scope & Vision

The Library Platform is a comprehensive, production-grade SaaS library management system featuring a social reading community and an interactive 2D floor-plan mapping engine.

### 1.1 Multi-Tenant Model
- **Central Control Plane:** Manages global user authentication, customer organizations, memberships/roles, invitations, tenant database routing registry, and control-plane audit logs.
- **Dedicated Organization Tenant Databases:** Each customer organization receives an entirely isolated PostgreSQL database.
- **Maximum 3 Libraries per Organization:** An organization can configure up to three independent library branches (e.g., Central Library, West Branch, Children's Library).
- **Strict Library Isolation:** Inventory copies, circulation, loans, reservations, branch wallets, and library settings never synchronize across library branches. Cross-library borrowing or automatic hold fulfillment across branches is prohibited.

---

## 2. User Roles & Capabilities

1. **`OWNER` (Organization Scope):**
   - Organization account ownership and billing status.
   - Database/tenant status inspection.
   - Create, rename, or archive library branches (enforcing max 3).
   - Manage organization Admins.
   - Initiate ownership transfer to another active organization member.
2. **`ADMIN` (Library / Organization Scope):**
   - Manage assigned library settings, circulation policies, and hours.
   - Manage library staff and roles (Librarians, Readers).
   - Floor-plan builder: create, edit, validate, and publish floor-plan versions.
   - Social content moderation (review reports, flagged comments).
   - Financial oversight: inspect fine liabilities, process fine waivers with mandatory audit reasons.
   - System audit log inspection and notification delivery diagnostics.
3. **`LIBRARIAN` (Library Branch Scope):**
   - Circulation desk: walk-in barcode checkout, return processing with condition assessment.
   - Reservation queue: copy allocation, physical placement confirmation (`READY_FOR_PICKUP`).
   - Catalog & inventory: register physical copies, bulk barcode intake, location hierarchy assignments.
   - Inventory exceptions: record damaged, lost, or withdrawn items.
4. **`READER` (Library Branch Patron):**
   - Discover & catalog search: faceted search with title, author, category, ISBN, and availability filters.
   - Availability & visual mapping: locate available copies on interactive 2D floor plans; view exact rack and shelf elevation.
   - Reservations & hold tracking: place holds on editions, view queue position, and monitor pickup deadlines.
   - Loans & renewals: view borrowed books, due dates, and request 7-day extensions.
   - Independent branch wallet & fines: simulated top-ups, view fine debts, and settle charges via append-only ledger.
   - Social reading: post reviews (with holding duration eligibility), upvote/downvote reviews, curate public/private book collections, and earn badges.
5. **`GUEST` (Public / Unauthenticated):**
   - Access marketing landing page and browse public book catalog metadata.
   - Exact copy availability, physical shelf locations, and circulation actions require logging in.

---

## 3. Circulation & State Machines

### 3.1 Reservation Lifecycle
```
[WAITLISTED] ──> [ALLOCATED] ──> [READY_FOR_PICKUP] ──> [FULFILLED]
     │                │                  │
     v                v                  v
[CANCELLED]      [CANCELLED]         [EXPIRED]
```

- **WAITLISTED:** Reader places a hold on an edition; no physical copy is currently available. Queue position is dynamically derived from `created_at`.
- **ALLOCATED:** A specific physical copy has been assigned to the reservation (e.g. upon return), but is still in returns processing and not yet on the pickup shelf.
- **READY_FOR_PICKUP:** Physical placement at designated pickup area/shelf is confirmed by staff. Countdown starts (`ready_at + 72 hours`). Reader map highlights exact pickup rack and shelf.
- **FULFILLED:** Librarian scans copy and confirms checkout to the reader; loan is created, copy status changes to `LOANED`, and reservation changes to `FULFILLED` in one atomic transaction.
- **EXPIRED:** Reader did not collect copy before deadline. Copy is released and automatically allocated to the next waitlisted reader.
- **CANCELLED:** Reader or staff cancels hold. Any assigned copy is released immediately.

### 3.2 Physical Copy Lifecycle
- `AVAILABLE` → `ON_HOLD` (when allocated or ready for pickup) → `LOANED` (checked out) → `AVAILABLE` (returned).
- Exceptions: `DAMAGED`, `LOST`, `WITHDRAWN`.

---

## 4. Financials & Independent Library Wallets

1. **Independent Branch Wallets:** A reader maintains an independent wallet balance per library branch (`wallets` keyed by `library_id, user_id`).
2. **Append-Only Ledger:** `wallet_transactions` records credits (simulated top-ups), debits (extension fees, fine settlements), and administrative adjustments. Rows are immutable.
3. **Fines vs Payments:** `fines` represents liability/debt; `wallet_transactions` represents actual cash movement.
4. **Overdue Fine Engine:** Scheduled worker assesses local daily overdue fines once per calendar day starting the day after `due_at`. Enforces unique `(loan_id, fine_date)` to guarantee idempotency.
5. **Loan Renewal Rules:**
   - Proactive extension (before due date): `new_due_at = due_at + 7 days`.
   - Late extension (after due date): `new_due_at = now + 7 days`. Overdue fines accrued to date remain owed.
   - Insufficient wallet funds rejects the extension without altering the loan. Max 2 extensions per loan.

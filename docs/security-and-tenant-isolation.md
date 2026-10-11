# Library Platform — Security & Tenant Isolation Plan

## 1. Authentication Architecture

### 1.1 Credential & Session Management
- **Password Security:** Passwords hashed with bcrypt (minimum cost factor 12) or Argon2id.
- **Session Tokens:** Stateless JWT with short expiration (15 minutes access token) + refresh token rotation (7 days) stored securely in `HttpOnly`, `SameSite=Lax`, `Secure` cookies.
- **Client Storage Rule:** Never store JWT tokens, tenant database passwords, or administrative secrets in browser `localStorage` or `sessionStorage`.

---

## 2. Multi-Tenant Isolation Guarantees

```
Client Request -> [JwtAuthGuard] -> [TenantResolverMiddleware] -> [TenantConnectionPool]
                        |                       |                             |
                Validates User       Resolves Org & DB Key         Injects Tenant DataSource
```

### 2.1 The Two-Tier Database Boundary
1. **No Direct Client Specification:** The client is never allowed to specify database names, ports, or raw database connection strings.
2. **Strict Verification Chain:**
   - Client specifies target organization via route param `/api/v1/orgs/:orgSlug` or header `X-Tenant-Slug`.
   - The backend looks up the organization in the Control Plane database and verifies that the authenticated `user_id` has an active entry in `org_memberships`.
   - Only after membership and status (`ACTIVE`) are verified does the backend look up the database credentials from `tenant_database_registry`.
   - The backend dynamically selects or boots the isolated `DataSource` for that organization.
3. **Cross-Tenant Leakage Prevention:**
   - Every tenant query runs against that organization's dedicated PostgreSQL database.
   - Even in the event of an application SQL error, it is physically impossible to access or join data from another organization because the tables live in completely different PostgreSQL databases.

---

## 3. Two-Tier Authorization Model (RBAC)

### 3.1 Organization-Level Roles (Control Plane)
- **`OWNER`:** Organization creator. Has sole authority to transfer ownership, manage organization billing, rename/archive libraries, view database status, and assign organization Admins.
- **`ADMIN`:** Organization-level administrator. Can configure organization-wide settings, manage staff, invite users, view organization-wide audit logs, and moderate social content.
- **`MEMBER`:** Standard organization member without administrative powers.

### 3.2 Library-Level Roles (Tenant Database)
- **`READER`:** Library patron at a specific branch. Can search catalog, reserve editions, borrow books, view availability on the floor plan, maintain their independent branch wallet, write reviews, and curate collections.
- **`LIBRARIAN`:** Staff member at a specific branch. Operates the circulation desk (checkout, returns), handles reservation hold fulfillment, scans barcodes, manages physical copy locations, and drafts floor plans.
- **`GUEST`:** Unauthenticated public user. Can view the landing page and public book catalog metadata. Exact copy availability, physical locations, and circulation actions require logging in.

### 3.3 NestJS Security Guards
- **`JwtAuthGuard`:** Validates central JWT signature, expiration, and user account status.
- **`OrgRoleGuard`:** Enforces organization-level permissions (`@RequireOrgRole('OWNER', 'ADMIN')`).
- **`LibraryRoleGuard`:** Validates membership in `library_memberships` for branch-specific endpoints (`@RequireLibraryRole('LIBRARIAN')`).

---

## 4. Concurrency & Transaction Security

1. **Physical Copy Locking:** Checkout, returns, and reservation allocation employ row-level locking (`SELECT ... FOR UPDATE`) on `book_copies` inside atomic transactions.
2. **Immutable Append-Only Ledger:** Financial transactions in `wallet_transactions` are append-only. Rows are never updated or deleted. Corrections are made via offsetting adjustment entries.
3. **Idempotency Keys:** All wallet transactions, fine charges, and delivery jobs enforce a unique `idempotency_key` constraint to protect against double-charging on network retries.
4. **Ownership Transfer Security:** Ownership transfer requires password re-verification, runs in a single control-plane transaction, and generates a permanent record in `control_plane_audit_logs`.

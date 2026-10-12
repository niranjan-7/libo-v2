# Known Limitations & Architectural Trade-offs

This document provides transparent disclosure of current system boundaries, approved design trade-offs, and intentionally scoped boundaries for Release 1.0.

---

## 1. Simulated Financial Transactions (No Real PSP Integration)

- **Behavior:** The wallet balance is backed by an append-only transaction ledger (`wallet_transactions`), supporting debit, credit, fine payments, and waivers with strict idempotency keys.
- **Limitation:** Top-ups are simulated. There is no live payment service provider (PSP) integration (e.g. Stripe, Razorpay, or Adyen). Real payment webhooks and external settlement flows are intentionally out of scope for this release.
- **Production Path:** In a future release, replace `POST /wallet/topup` with a payment intent flow that creates a pending ledger record and fulfills it via verified webhook signatures.

---

## 2. Three-Library Limit Per Organization

- **Behavior:** Organizations are strictly limited to a maximum of 3 branch libraries.
- **Implementation:** Enforced race-safely via PostgreSQL advisory transaction locks (`SELECT pg_advisory_xact_lock(hashtext('org_lib_limit_' || $1))`) before verifying `COUNT(*) < 3` and inserting.
- **Limitation:** Expanding beyond 3 libraries requires altering subscription tier validation and advisory lock thresholds.

---

## 3. Floor-Plan Wayfinding & Navigation

- **Behavior:** The floor-plan editor supports spatial element placement (RACK, WALL, DOOR, DESK), versioning (draft/published/restore), coordinate/rotation persistence, and linking spatial racks to logical inventory locations.
- **Limitation:** Shortest-path Dijkstra/A* pathfinding navigation between user position and target shelf is explicitly excluded from this release. Readers inspect shelf contents by clicking physical racks on the map.

---

## 4. Application-Level Central User ID Integrity

- **Behavior:** PostgreSQL does not support cross-database foreign key constraints. User identities live in `control_plane_db.users`, while library memberships and reader profiles live in `tenant_*.reader_profiles`.
- **Limitation:** Foreign keys between `tenant_*.reader_profiles.user_id` and `control_plane_db.users.user_id` cannot be enforced at the database level.
- **Safeguard:** Handled via application-level validation in `OrganizationsService` and `AuthService`, ensuring user presence before creating tenant memberships and reader profiles.

---

## 5. Notification Transports

- **Behavior:** Notifications support in-app inbox delivery records, unread counters, notification types (`RESERVATION_READY`, `RESERVATION_EXPIRED`, `LOAN_DUE_SOON`, `OVERDUE_FINE`), delivery attempts, and retry tracking.
- **Limitation:** External delivery gateways (SendGrid/SMTP for email, Twilio for SMS, WebPush) are not bundled by default; notifications are recorded in `notification_deliveries` with simulated successful dispatch or configurable dispatch webhooks.

---

## 6. Single Cluster vs. Multi-Region Sharding

- **Behavior:** Currently, `TenantDatabaseRegistryService` provisions tenant databases on the cluster defined by `TENANT_DB_HOST`.
- **Limitation:** While the registry schema supports individual `host` and `port` fields per tenant, the provisioning service currently assigns them to the primary configured database host rather than dynamically balancing across heterogeneous multi-cloud database instances.

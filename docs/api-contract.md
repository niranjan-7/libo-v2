# Library Platform — API Contract Specification

## 1. Global / Control-Plane Endpoints

### 1.1 Authentication (`/api/v1/auth`)
- `POST /register`: Registers a global user (`email`, `password`, `displayName`). Returns user info and JWT session cookie.
- `POST /login`: Authenticates credentials. Sets `HttpOnly` JWT cookie.
- `POST /logout`: Clears session cookie.
- `GET /me`: Returns current user identity, organization memberships, and active roles.

### 1.2 Organizations & Onboarding (`/api/v1/organizations`)
- `POST /`: Creates an organization, provisions the isolated tenant PostgreSQL database, applies migrations, and assigns the user as `OWNER`.
  - Body: `{ name: string, slug: string, initialLibraryName: string }`
- `GET /`: Lists organizations where the user has active membership.
- `GET /:slug`: Returns organization details and active libraries (max 3).
- `POST /:slug/transfer-ownership`: Transfers owner role to another active member. Requires password re-authentication.

### 1.3 Invitations & Access (`/api/v1/organizations/:orgId/members`)
- `GET /`: Lists all members, roles, and branch assignments.
- `POST /invitations`: Sends organization or library invitation.
- `DELETE /invitations/:id`: Revokes a pending invitation.
- `PATCH /:userId/role`: Updates organization role (`ADMIN`, `MEMBER`).

---

## 2. Tenant Organization & Library Endpoints

All tenant routes require valid authentication and an active organization membership context.

### 2.1 Branch Management (`/api/v1/libraries`)
- `GET /`: Returns libraries in the organization (up to 3).
- `POST /`: Creates an additional library (enforces maximum of 3 limit).
- `GET /:libraryId`: Returns library branch details and settings.
- `PATCH /:libraryId`: Updates library name, slug, or timezone.

### 2.2 Book Catalog (`/api/v1/catalog`)
- `GET /books`: Faceted search and filtering by query, category, availability, author, sort order (`relevance`, `title`, `year`).
- `GET /books/:id`: Full intellectual work details, author credits, edition list, reader review summary.
- `POST /books`: Creates intellectual work (Librarian/Admin).
- `POST /books/:id/editions`: Adds published edition with ISBN and replacement cost.

### 2.3 Physical Inventory & Locations (`/api/v1/libraries/:libraryId/inventory`)
- `GET /copies`: Lists physical copies, barcodes, current locations, and conditions.
- `POST /copies`: Registers an individual physical copy with barcode and home location.
- `POST /copies/bulk-intake`: Registers multiple physical copies at once from scanned barcodes.
- `PATCH /copies/:copyId/condition`: Updates copy condition or reports exception (`LOST`, `DAMAGED`, `WITHDRAWN`).
- `GET /locations`: Returns hierarchical tree of zones, racks, and shelves.
- `POST /locations`: Creates zone, rack, or shelf.

### 2.4 Circulation & Reservations (`/api/v1/libraries/:libraryId/circulation`)
- `POST /reservations`: Reader reserves an edition. Allocates available copy or places reader on waitlist.
- `DELETE /reservations/:id`: Cancels reservation and releases allocated copy.
- `GET /reservations/tracking`: Reader checks queue position and pickup deadlines.
- `GET /queue`: Librarian monitors waitlisted, allocated, and ready requests.
- `POST /fulfillment/:reservationId/ready`: Staff confirms physical placement at pickup shelf; starts 72-hour countdown.
- `POST /checkout`: Librarian checks out copy to reader (reservation path or walk-in). Marks copy `LOANED` in one transaction.
- `POST /returns`: Librarian scans returned copy, assesses condition, updates loan, and routes copy to next hold or reshelving.
- `POST /extensions/:loanId`: Reader requests loan extension. Validates limit (max 2), waitlist status, and wallet balance.

### 2.5 2D Floor Plans & Spatial Mapping (`/api/v1/libraries/:libraryId/floors`)
- `GET /`: Lists floors for the library.
- `GET /:floorId/published`: Reader query returning published floor fixtures and available copy locations.
- `GET /:floorId/draft`: Admin/Librarian query returning editable layout version.
- `POST /:floorId/elements`: Adds or updates spatial fixtures (racks, walls, desks, doors).
- `POST /:floorId/publish`: Validates layout (no unlinked racks, no duplicates) and publishes version.

### 2.6 Financials & Independent Wallets (`/api/v1/libraries/:libraryId/finance`)
- `GET /wallet/me`: Returns reader's wallet balance and immutable ledger transactions for this branch.
- `POST /wallet/topup`: Simulated credit addition (`₹100`, `₹250`, `₹500`).
- `GET /fines/me`: Returns unpaid fine liabilities for this branch.
- `POST /fines/:fineId/settle`: Debits wallet to clear fine atomically.
- `POST /fines/:fineId/waive`: Admin waives fine with mandatory audit reason.

### 2.7 Social Features & Community (`/api/v1/social`)
- `GET /books/:bookId/reviews`: Published reader reviews with rating and vote counts.
- `POST /books/:bookId/reviews`: Submits review. Enforces 7-day holding duration eligibility.
- `POST /reviews/:reviewId/votes`: Upvote (+1) or downvote (-1). Toggles or updates vote.
- `GET /collections`: Public curated book collections.
- `POST /collections`: Creates curated list. Requires 20 distinct books read threshold.

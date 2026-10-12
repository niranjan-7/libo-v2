# Library Platform — Production Monorepo

A multi-tenant library management platform featuring a social reading community, an interactive 2D floor-plan mapping engine, and strictly isolated per-organization PostgreSQL databases.

---

## 1. Technology Stack

- **Backend:** NestJS 10+ with TypeScript, TypeORM (dynamic multi-tenant DataSource connection pool management).
- **Frontend:** React 18 with TypeScript, Vite 6, and design tokens matching the approved visual reference.
- **Persistence:** PostgreSQL 16 (Central Control Plane database + isolated Tenant databases).
- **Shared Contracts:** `@library/contracts` for cross-boundary types, enums, and validation DTOs.
- **Visual Design Reference:** `design-reference/library_platform_interactive_prototype_v2.html`.

---

## 2. Monorepo Structure

```text
library-platform/
├── apps/
│   ├── api/                      # NestJS REST API Gateway (Port 3000)
│   └── web/                      # React 18 + Vite Web Application (Port 5173)
├── packages/
│   └── contracts/                # Shared TypeScript types, enums, and DTOs
├── infra/
│   ├── docker-compose.yml        # Local PostgreSQL container with healthcheck
│   └── init-scripts/             # Database initialization & extension scripts
├── docs/                         # System specifications & ADRs
│   ├── architecture.md           # High-level architecture & ADRs
│   ├── data-model.md             # Complete 37-table ERD & schema
│   ├── security-and-tenant-isolation.md # Security, RBAC, and boundary controls
│   ├── api-contract.md           # REST endpoint contracts
│   ├── implementation-plan.md    # Milestone roadmap & status log
│   ├── product-requirements.md   # PRD & circulation business rules
│   ├── design-audit.md           # Tokens, theme presets, and 30-screen inventory
│   ├── deployment.md             # Production deployment guide & reverse proxy setup
│   ├── runbook.md                # Operations, backups, disaster recovery & migrations
│   ├── environment-variables.md  # Comprehensive environment variable reference
│   ├── known-limitations.md      # Documented constraints & architectural trade-offs
│   └── feature-coverage.md       # Final feature matrix & verification log
├── design-reference/
│   └── library_platform_interactive_prototype_v2.html # Standalone visual standard
├── README.md                     # Root project documentation
└── .env.example                  # Environment configuration template
```

---

## 3. Getting Started & Local Environment

### Prerequisites
- **Node.js:** v20.x or v22.x LTS
- **npm:** v10.x or higher
- **Docker & Docker Compose** (or local PostgreSQL 15/16 service on port 5432)

### 3.1 Initial Setup
1. Clone the repository and navigate to the project directory:
   ```bash
   cd c:\code\libo-v2
   ```
2. Copy the environment configuration:
   ```bash
   cp .env.example .env
   ```
3. Install dependencies across all workspaces:
   ```bash
   npm install
   ```

---

## 4. Environment Commands (Start, Stop, Reset, Test)

### 4.1 Database Infrastructure
- **Start PostgreSQL:**
  ```bash
  npm run db:up
  # Or: docker compose -f infra/docker-compose.yml up -d
  ```
- **Stop PostgreSQL:**
  ```bash
  npm run db:down
  # Or: docker compose -f infra/docker-compose.yml down
  ```
- **Reset PostgreSQL (destroys data volumes and restarts fresh):**
  ```bash
  npm run db:reset
  # Or: docker compose -f infra/docker-compose.yml down -v && docker compose -f infra/docker-compose.yml up -d
  ```

### 4.2 Database Migrations
- **Run Control-Plane Migrations:**
  ```bash
  npm run migration:run --workspace=@library/api
  ```
  Applies the central control plane schema: `users`, `organizations`, `org_memberships`, `org_invitations`, `tenant_database_registry`, and `control_plane_audit_logs`.

- **Run Fleet-Wide Tenant Migrations:**
  ```bash
  npm run migration:tenant:run --workspace=@library/api
  ```
  Applies tenant schema migrations across all registered healthy tenant databases.

### 4.3 Running Applications
- **Start NestJS API (Development mode with hot reload):**
  ```bash
  npm run dev:api
  # API Gateway runs at: http://localhost:3000/api/v1
  # Health endpoint:    http://localhost:3000/api/v1/health
  ```
- **Start React Frontend (Development mode with Vite):**
  ```bash
  npm run dev:web
  # Frontend runs at:    http://localhost:5173
  ```

### 4.4 Quality & Validation Commands
- **Type-Check All Workspaces:**
  ```bash
  npm run typecheck
  ```
- **Run Unit Tests:**
  ```bash
  npm run test
  ```
- **Run PostgreSQL Integration Test Suite (93 tests across 8 suites):**
  ```bash
  npm run test:integration --workspace=@library/api
  ```
- **Run Linters:**
  ```bash
  npm run lint
  ```
- **Build All Workspaces for Production:**
  ```bash
  npm run build
  ```

---

## 5. Health Endpoints & Connectivity Probe

The API provides standardized health and readiness endpoints:
- `GET /api/v1/health`: Returns overall status (`ok` or `degraded`), uptime, environment, and control-plane database connection state with latency in milliseconds.
- `GET /api/v1/health/ready`: Returns `{ ready: true }` if the database is reachable.
- `GET /api/v1/health/live`: Returns `{ live: true }` process heartbeat.

The React frontend (`apps/web`) features a built-in **System Scaffold Connectivity** dashboard component that probes `/api/v1/health` in real time and displays connection status, database status, latency, and system telemetry using the prototype's visual tokens.

---

## 6. Architecture & Security Highlights

1. **One ORM Consistently:** TypeORM is used across all modules. Schema auto-synchronization is strictly disabled in production (`synchronize: false`).
2. **Control Plane vs. Tenant Databases:**
   - Central control plane stores global users, organizations, invitations, and routing metadata.
   - Dynamic `TenantConnectionService` manages an LRU cache of isolated PostgreSQL `DataSource` instances for each organization with a 10-minute idle eviction policy.
3. **Strict Library Isolation:** Each organization supports up to 3 independent library branches. Inventory, loans, reservations, branch wallets, and settings never cross library boundaries.

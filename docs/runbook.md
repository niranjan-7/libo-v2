# Operations & Database Runbook

This runbook establishes standard operating procedures (SOPs) for database backups, disaster recovery, tenant database provisioning, tenant migrations, and connection management.

---

## 1. Database Backup Procedures

Because the platform uses a hybrid multi-tenant model (one central control-plane database and separate isolated databases per tenant organization), backup procedures handle both the central metadata catalog and individual tenant databases.

### 1.1 Central Control-Plane Backup

The control plane stores user accounts, organization registries, memberships, invitations, and routing secrets.

```bash
# 1. Automated logical dump of control plane
pg_dump \
  -h "${CONTROL_PLANE_DB_HOST:-localhost}" \
  -p "${CONTROL_PLANE_DB_PORT:-5432}" \
  -U "${CONTROL_PLANE_DB_USER:-postgres}" \
  -F c -b -v \
  -f "/backups/control_plane_$(date +%Y%m%d_%H%M%S).dump" \
  "${CONTROL_PLANE_DB_NAME:-control_plane_db}"
```

### 1.2 Tenant Fleet Backup Automation

To snapshot all tenant databases, query the `tenant_database_registry` table in the control plane and execute individual dumps:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/backups/tenants/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# Query active tenant database names from control-plane
TENANTS=$(psql -h "$CONTROL_PLANE_DB_HOST" -U "$CONTROL_PLANE_DB_USER" -d "$CONTROL_PLANE_DB_NAME" -t -A -c \
  "SELECT database_name FROM tenant_database_registry WHERE status = 'HEALTHY'")

for T_DB in $TENANTS; do
  echo "Backing up tenant database: $T_DB..."
  pg_dump \
    -h "$TENANT_DB_HOST" \
    -p "$TENANT_DB_PORT" \
    -U "$TENANT_DB_USER" \
    -F c -b \
    -f "$BACKUP_DIR/${T_DB}.dump" \
    "$T_DB"
done

echo "Tenant fleet backup complete. Dumps stored in $BACKUP_DIR."
```

---

## 2. Disaster Recovery & Restore Procedures

### 2.1 Restoring the Control Plane

```bash
# 1. Drop and recreate clean database target
dropdb -h "$CONTROL_PLANE_DB_HOST" -U "$CONTROL_PLANE_DB_USER" "$CONTROL_PLANE_DB_NAME"
createdb -h "$CONTROL_PLANE_DB_HOST" -U "$CONTROL_PLANE_DB_USER" "$CONTROL_PLANE_DB_NAME"

# 2. Restore from custom-format backup
pg_restore \
  -h "$CONTROL_PLANE_DB_HOST" \
  -U "$CONTROL_PLANE_DB_USER" \
  -d "$CONTROL_PLANE_DB_NAME" \
  -v "/backups/control_plane_YYYYMMDD_HHMMSS.dump"

# 3. Verify control-plane migrations
npm run migration:run --workspace=@library/api
```

### 2.2 Restoring a Specific Tenant Database

If a single tenant database experiences corruption or accidental table modification:

```bash
TENANT_DB="tenant_acme_library_a1b2c3d4"

# 1. Terminate all active backend connections from NestJS connection pool
psql -h "$TENANT_DB_HOST" -U "$TENANT_DB_USER" -d postgres -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = '$TENANT_DB' AND pid <> pg_backend_pid();
"

# 2. Re-create the target database
dropdb -h "$TENANT_DB_HOST" -U "$TENANT_DB_USER" "$TENANT_DB"
createdb -h "$TENANT_DB_HOST" -U "$TENANT_DB_USER" "$TENANT_DB"

# 3. Restore dump
pg_restore \
  -h "$TENANT_DB_HOST" \
  -U "$TENANT_DB_USER" \
  -d "$TENANT_DB" \
  -v "/backups/tenants/YYYYMMDD/${TENANT_DB}.dump"

# 4. Verify tenant migrations
npm run migration:tenant:run --workspace=@library/api
```

---

## 3. Tenant Provisioning Lifecycle

Tenant database provisioning is fully automated and triggered on organization registration:

1. **Organization Creation:**
   - The user submits an organization creation request (`POST /api/v1/organizations`).
   - The central control plane transaction inserts the `organizations` record and creator's `OWNER` membership.
2. **Database Naming & Sanitization:**
   - Database name is generated deterministically: `tenant_${slug}_${orgIdPrefix}`.
   - Slugs are restricted to `[a-z0-9_]` with length ceilings. No client-supplied connection parameters are ever accepted.
3. **Physical Creation & Schema Migration:**
   - `CREATE DATABASE "<database_name>"` is executed on the PostgreSQL instance.
   - Initial tenant migrations (`1700000000001-InitialTenantSchema.ts`) are immediately executed, creating all 31 tenant-specific tables, triggers, and indices.
4. **Registry Registration:**
   - A row is written to `tenant_database_registry` with `status = 'HEALTHY'` and `schema_version = '1.0.0'`.
5. **Initial Library Provisioning:**
   - The initial library branch is provisioned with default timezone and reader profile.

---

## 4. Database Migration Management

The platform separates schema evolutions into two independent execution paths. Auto-sync (`synchronize: false`) is strictly disabled in all environments.

### 4.1 Running Control Plane Migrations
Applies central migrations to `control_plane_db`:
```bash
npm run migration:run --workspace=@library/api
```

### 4.2 Running Fleet-Wide Tenant Migrations
Applies new tenant schema versions across all registered healthy tenant databases:
```bash
npm run migration:tenant:run --workspace=@library/api
```

To migrate a single specific organization tenant database:
```bash
npx ts-node -r tsconfig-paths/register ./src/database/cli/run-tenant-migrations.ts "<organization_id>"
```

---

## 5. Connection Pool Management & Monitoring

The NestJS API employs an LRU-managed `TenantConnectionService`:

- **Pool Size:** Each active tenant database maintains a local connection pool (default: 5 connections, max: 20).
- **Idle Eviction Policy:** Any tenant pool idle for >10 minutes is automatically destroyed and removed from the active map.
- **Graceful Shutdown:** On `SIGTERM` / `SIGINT`, `TenantConnectionService.onApplicationShutdown()` awaits active queries and cleanly destroys all open pools.

To inspect active PostgreSQL server connection counts:
```sql
SELECT datname, count(*) as active_connections
FROM pg_stat_activity
GROUP BY datname
ORDER BY active_connections DESC;
```

# Production Deployment Guide

This guide details the steps and architecture required to deploy the Multi-Tenant Library Management Platform to a production Linux/Container environment.

---

## 1. Production Architecture Overview

The system runs as three core operational tiers:

```text
[ Client Browsers ]
         │ (HTTPS: 443)
         ▼
[ Ingress / Reverse Proxy (Nginx / Caddy / Cloudflare) ]
   ├── Static Web Assets (/ -> React Vite SPA build)
   └── API Proxy (/api/v1/* -> NestJS API Gateway)
         │
         ▼
[ NestJS API Gateway Cluster (Node.js LTS, Port 3000) ]
   ├── JWT Auth & Role-Based Access Guards
   ├── Control Plane TypeORM DataSource
   └── Dynamic Tenant Connection Pool (TenantConnectionService LRU Cache)
         │
         ▼
[ PostgreSQL 16 Fleet / Managed Cluster ]
   ├── control_plane_db (Users, Orgs, Memberships, Invitations, Tenant Registry)
   └── tenant_* databases (Dedicated, isolated per-organization schemas)
```

---

## 2. Infrastructure & System Requirements

- **Operating System:** Linux (Ubuntu 22.04 LTS / Debian 12 / Alpine Container)
- **Node.js Runtime:** Node.js v20.x or v22.x LTS
- **Package Manager:** npm v10.x or pnpm v9.x
- **Database:** PostgreSQL 16+ with `uuid-ossp` extension enabled
- **Reverse Proxy:** Nginx 1.24+ or Caddy 2.7+
- **Process Manager:** Docker Compose, Kubernetes, or PM2
- **Hardware Sizing (Base Production):**
  - API Gateway: 2 vCPUs, 4 GB RAM per instance
  - PostgreSQL Instance: 4 vCPUs, 16 GB RAM, High-IOPS SSD (minimum 500 IOPS)

---

## 3. Environment Configuration & Secret Management

Before deploying, populate production environment variables in your secure vault (e.g., AWS Secrets Manager, HashiCorp Vault, Google Secret Manager, or Kubernetes Secrets).

**Never commit production `.env` files to source control.**

```bash
# Core Environment
NODE_ENV=production
PORT=3000
API_PREFIX=/api/v1
CORS_ORIGIN=https://library.yourdomain.com

# Control Plane Database
CONTROL_PLANE_DB_HOST=postgres.internal.net
CONTROL_PLANE_DB_PORT=5432
CONTROL_PLANE_DB_USER=libo_control_admin
CONTROL_PLANE_DB_PASSWORD=<SECURE_STRONG_PASSWORD>
CONTROL_PLANE_DB_NAME=control_plane_db
CONTROL_PLANE_DB_LOGGING=false

# Tenant Database Provisioning Credentials
TENANT_DB_HOST=postgres.internal.net
TENANT_DB_PORT=5432
TENANT_DB_USER=libo_tenant_provisioner
TENANT_DB_PASSWORD=<SECURE_STRONG_PASSWORD>

# Cryptography & Auth Secrets
JWT_SECRET=<MINIMUM_64_CHARACTER_RANDOM_ENTROPY_KEY>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Frontend API Endpoint
VITE_API_URL=https://library.yourdomain.com/api/v1
```

---

## 4. Production Build Steps

Execute the production build from the monorepo root:

```bash
# 1. Install locked dependencies
npm ci

# 2. Compile shared contracts, NestJS API, and React frontend
npm run build

# Verified Output:
# - packages/contracts/dist/
# - apps/api/dist/
# - apps/web/dist/
```

---

## 5. Control-Plane Schema Initialization

Prior to launching the API service, apply all pending control plane migrations:

```bash
npm run migration:run --workspace=@library/api
```

This verifies and initializes:
- `users`
- `organizations`
- `org_memberships`
- `org_invitations`
- `tenant_database_registry`
- `control_plane_audit_logs`

*Note: `synchronize: false` is permanently enforced. The application will never mutate database schemas automatically on startup.*

---

## 6. Nginx Ingress & Reverse Proxy Setup

Place the following configuration in `/etc/nginx/sites-available/library-platform.conf`:

```nginx
server {
    listen 80;
    server_name library.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name library.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/library.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/library.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Static Web SPA Assets
    root /var/www/library-platform/apps/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api/v1/ {
        proxy_pass http://127.0.0.1:3000/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90s;
    }
}
```

---

## 7. Process Management (PM2 Example)

Create an `ecosystem.config.js` for process persistence and cluster mode:

```javascript
module.exports = {
  apps: [
    {
      name: 'library-api',
      cwd: './apps/api',
      script: 'dist/main.js',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
```

Start the application cluster:
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

---

## 8. Health Probes & Monitoring

The API exposes three health monitoring endpoints:

1. **Liveness Heartbeat:** `GET /api/v1/health/live`
   - Returns `{ "live": true }`
   - Use for Kubernetes liveness probes.

2. **Readiness Probe:** `GET /api/v1/health/ready`
   - Returns `{ "ready": true }` if control-plane database is responding.
   - Use for Kubernetes readiness probes.

3. **Diagnostic Health Status:** `GET /api/v1/health`
   - Returns comprehensive subsystem status, database latency (in ms), and memory metrics:
   ```json
   {
     "status": "ok",
     "info": {
       "controlPlaneDatabase": {
         "status": "up",
         "latencyMs": 2
       }
     },
     "details": {
       "controlPlaneDatabase": {
         "status": "up",
         "latencyMs": 2
       }
     }
   }
   ```

# Environment Variables Reference

This document provides a comprehensive specification of all environment variables supported by the Library Platform across the backend API Gateway (`apps/api`) and the frontend web application (`apps/web`).

---

## 1. Application Core Configuration

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `NODE_ENV` | Yes | `development` | Operating environment: `development`, `test`, or `production`. Controls logging verbosity and security flags. |
| `PORT` | No | `3000` | HTTP port on which the NestJS API gateway listens. |
| `API_PREFIX` | No | `/api/v1` | URL prefix for all REST controllers and routes. |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origin. In production, set to the exact frontend domain (e.g. `https://library.yourdomain.com`). |

---

## 2. Control-Plane Database Configuration

The control-plane database stores global entities: Users, Organizations, Memberships, Invitations, Tenant Registry, and Control Plane Audit Logs.

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `CONTROL_PLANE_DB_HOST` | Yes | `localhost` | Hostname or IP of the control-plane PostgreSQL instance. |
| `CONTROL_PLANE_DB_PORT` | No | `5432` | Port of the control-plane PostgreSQL instance. |
| `CONTROL_PLANE_DB_USER` | Yes | `postgres` | Database superuser or administrator with permissions to manage `control_plane_db` and issue `CREATE DATABASE`. |
| `CONTROL_PLANE_DB_PASSWORD` | Yes | `postgres` | Password for the control-plane database user. |
| `CONTROL_PLANE_DB_NAME` | No | `control_plane_db` | Name of the primary control-plane database. |
| `CONTROL_PLANE_DB_LOGGING`| No | `false` | Enable TypeORM SQL query logging (`true`/`false`). Recommended `false` in production. |

---

## 3. Tenant Database Fleet Configuration

These credentials are used by `TenantDatabaseRegistryService` and `TenantConnectionService` to provision and connect to isolated tenant databases.

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `TENANT_DB_HOST` | Yes | `localhost` | Hostname or IP of the PostgreSQL instance hosting tenant databases. |
| `TENANT_DB_PORT` | No | `5432` | Port of the tenant PostgreSQL instance. |
| `TENANT_DB_USER` | Yes | `postgres` | PostgreSQL user used to connect to provisioned tenant databases. |
| `TENANT_DB_PASSWORD` | Yes | `postgres` | PostgreSQL password used to connect to provisioned tenant databases. |
| `TENANT_DB_TEMPLATE_NAME`| No | `tenant_template_db` | Optional database template name if creating databases via `TEMPLATE`. |

*Note: Database names, hosts, and credentials are strictly held in server memory and control-plane registry. They are never sent to the client.*

---

## 4. Security & Cryptography Configuration

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `JWT_SECRET` | Yes | `super_secret_jwt_key...` | Cryptographic secret for signing and verifying JWT access tokens. In production, must be at least 64 random alphanumeric characters. |
| `JWT_EXPIRES_IN` | No | `15m` | Lifetime of the short-lived JWT access token (e.g. `15m`, `1h`). |
| `REFRESH_TOKEN_EXPIRES_IN` | No | `7d` | Lifetime of HTTP-only refresh tokens (e.g. `7d`, `30d`). |

---

## 5. Frontend Web Application (`apps/web`)

Configured at build time via Vite environment variables (prefixed with `VITE_`):

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `VITE_API_URL` | Yes | `http://localhost:3000/api/v1` | Base URL used by the Axios/Fetch API client to communicate with the NestJS gateway. In production, configure to the reverse-proxy endpoint (e.g. `https://library.yourdomain.com/api/v1`). |

---

## 6. Example `.env` for Development

```env
NODE_ENV=development
PORT=3000
API_PREFIX=/api/v1
CORS_ORIGIN=http://localhost:5173

CONTROL_PLANE_DB_HOST=127.0.0.1
CONTROL_PLANE_DB_PORT=5432
CONTROL_PLANE_DB_USER=postgres
CONTROL_PLANE_DB_PASSWORD=postgres
CONTROL_PLANE_DB_NAME=control_plane_db
CONTROL_PLANE_DB_LOGGING=false

TENANT_DB_HOST=127.0.0.1
TENANT_DB_PORT=5432
TENANT_DB_USER=postgres
TENANT_DB_PASSWORD=postgres

JWT_SECRET=development_jwt_secret_key_minimum_32_characters_for_security_123
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

VITE_API_URL=http://localhost:3000/api/v1
```

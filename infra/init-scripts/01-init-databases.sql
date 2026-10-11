-- ============================================================
-- Library Platform: Initial PostgreSQL Databases Setup
-- ============================================================

-- Ensure pgcrypto extension in control_plane_db
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create tenant template database for cloning / schema initialization
SELECT 'CREATE DATABASE tenant_template_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'tenant_template_db')\gexec

-- Connect to tenant_template_db and install extensions
\c tenant_template_db
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

async function sync() {
  const cp = new DataSource({
    type: 'postgres',
    host: process.env.CONTROL_PLANE_DB_HOST || 'localhost',
    port: Number(process.env.CONTROL_PLANE_DB_PORT || 5432),
    username: process.env.CONTROL_PLANE_DB_USER || 'postgres',
    password: process.env.CONTROL_PLANE_DB_PASSWORD || 'postgres',
    database: process.env.CONTROL_PLANE_DB_NAME || 'control_plane_db',
  });

  await cp.initialize();
  const tenants = await cp.query(
    `SELECT organization_id, database_name, host, port FROM tenant_database_registry WHERE status = 'HEALTHY'`
  );

  console.log(`Found ${tenants.length} tenant database(s) to synchronize...`);

  for (const t of tenants) {
    const tDs = new DataSource({
      type: 'postgres',
      host: t.host || 'localhost',
      port: Number(t.port || 5432),
      username: process.env.TENANT_DB_USER || 'postgres',
      password: process.env.TENANT_DB_PASSWORD || 'postgres',
      database: t.database_name,
    });

    try {
      await tDs.initialize();
      const libs = await tDs.query(
        `SELECT library_id, name, slug, timezone, status, created_at FROM libraries`
      );

      for (const lib of libs) {
        await cp.query(
          `INSERT INTO libraries_directory (library_id, organization_id, name, slug, timezone, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (library_id) DO UPDATE 
           SET name = EXCLUDED.name, slug = EXCLUDED.slug, status = EXCLUDED.status`,
          [
            lib.library_id,
            t.organization_id,
            lib.name,
            lib.slug,
            lib.timezone,
            lib.status,
            lib.created_at,
          ]
        );
        console.log(`Synced library '${lib.name}' (${lib.library_id}) for org ${t.organization_id}`);
      }
    } catch (err: any) {
      console.error(`Error syncing tenant ${t.database_name}:`, err.message);
    } finally {
      if (tDs.isInitialized) {
        await tDs.destroy();
      }
    }
  }

  await cp.destroy();
  console.log('Synchronization complete.');
}

sync().catch((err) => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});

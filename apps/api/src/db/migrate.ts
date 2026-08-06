import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Resolve migrations dir for src/ and dist/ layouts. */
export function migrationsDir(): string {
  const candidates = [
    join(__dirname, "../../migrations"), // src/db → apps/api/migrations
    join(__dirname, "../migrations"), // dist/db → dist/migrations (if copied)
    join(process.cwd(), "migrations"),
    join(process.cwd(), "apps/api/migrations"),
  ];
  for (const c of candidates) {
    try {
      readdirSync(c);
      return c;
    } catch {
      /* try next */
    }
  }
  return candidates[0];
}

/**
 * Simple ordered SQL migrations.
 * Files: apps/api/migrations/NNN_name.sql applied once by filename.
 */
export async function runMigrations(pool: pg.Pool): Promise<string[]> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Prefer pgcrypto/gen_random_uuid — available on PG 13+ as built-in
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  const dir = migrationsDir();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied: string[] = [];
  for (const file of files) {
    const exists = await pool.query(
      `SELECT 1 FROM schema_migrations WHERE id = $1`,
      [file],
    );
    if (exists.rowCount && exists.rowCount > 0) continue;

    const sql = readFileSync(join(dir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [file]);
      await client.query("COMMIT");
      applied.push(file);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  return applied;
}

import { loadConfig } from "../config.js";
import { createPgPool, migrate } from "../db/pg-store.js";

async function main() {
  const config = loadConfig();
  if (!config.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const pool = await createPgPool(config.DATABASE_URL);
  await migrate(pool);
  console.log("migrate ok");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

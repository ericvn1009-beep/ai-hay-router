import { loadConfig } from "../config.js";
import { createPgPool, migrate } from "../db/pg-store.js";

async function main() {
  const config = loadConfig();
  if (!config.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const pool = await createPgPool(config.DATABASE_URL);
  const applied = await migrate(pool);
  console.log(
    applied.length
      ? `migrate ok; applied: ${applied.join(", ")}`
      : "migrate ok; already up to date",
  );
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * CLI: manage AI Hay API keys
 *
 *   pnpm aihay keys create --name local-dev
 *   pnpm aihay keys list
 *   pnpm aihay keys revoke --prefix sk-aihay-xxxx
 */
import { bootstrapStores } from "../bootstrap.js";
import { loadConfig } from "../config.js";
import { createLogger } from "../lib/logger.js";

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const config = loadConfig();
  const logger = createLogger("error");
  const stores = await bootstrapStores(config, logger);

  try {
    if (cmd === "create") {
      const name = flag(rest, "name") ?? "default";
      const { record, secret } = await stores.keys.createKey({ name });
      console.log(JSON.stringify({ id: record.id, name: record.name, prefix: record.keyPrefix }, null, 2));
      console.log("");
      console.log("API key (copy now; will not be shown again):");
      console.log(secret);
      return;
    }

    if (cmd === "list") {
      const keys = await stores.keys.listKeys();
      console.log(
        JSON.stringify(
          keys.map((k) => ({
            id: k.id,
            name: k.name,
            prefix: k.keyPrefix,
            revoked: Boolean(k.revokedAt),
            rpm: k.rateLimitRpm,
            created_at: k.createdAt,
          })),
          null,
          2,
        ),
      );
      return;
    }

    if (cmd === "revoke") {
      const prefix = flag(rest, "prefix");
      if (!prefix) {
        console.error("Usage: keys revoke --prefix sk-aihay-xxxx");
        process.exit(1);
      }
      const ok = await stores.keys.revokeByPrefix(prefix);
      console.log(ok ? "revoked" : "no matching active key");
      return;
    }

    console.error(`Usage:
  pnpm aihay keys create --name <name>
  pnpm aihay keys list
  pnpm aihay keys revoke --prefix <prefix>
`);
    process.exit(1);
  } finally {
    await stores.close();
  }
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  if (i >= 0) return args[i + 1];
  return undefined;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

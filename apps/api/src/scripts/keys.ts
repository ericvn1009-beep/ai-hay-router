/**
 * CLI: manage AI Hay API keys
 *
 *   pnpm keys create --name local-dev
 *   pnpm keys create --name app --workspace <uuid>
 *   pnpm keys list
 *   pnpm keys list --workspace <uuid>
 *   pnpm keys revoke --prefix sk-aihay-xxxx
 *   pnpm keys workspaces
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
      const workspaceId = flag(rest, "workspace");
      const { record, secret } = await stores.keys.createKey({
        name,
        workspaceId: workspaceId ?? undefined,
      });
      console.log(
        JSON.stringify(
          {
            id: record.id,
            name: record.name,
            prefix: record.keyPrefix,
            workspace_id: record.workspaceId,
          },
          null,
          2,
        ),
      );
      console.log("");
      console.log("API key (copy now; will not be shown again):");
      console.log(secret);
      return;
    }

    if (cmd === "list") {
      const workspaceId = flag(rest, "workspace");
      const keys = await stores.keys.listKeys(
        workspaceId ? { workspaceId } : undefined,
      );
      console.log(
        JSON.stringify(
          keys.map((k) => ({
            id: k.id,
            name: k.name,
            prefix: k.keyPrefix,
            workspace_id: k.workspaceId,
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
        console.error("Usage: keys revoke --prefix sk-aihay-xxxx [--workspace <id>]");
        process.exit(1);
      }
      const workspaceId = flag(rest, "workspace");
      const ok = await stores.keys.revokeByPrefix(
        prefix,
        workspaceId ? { workspaceId } : undefined,
      );
      console.log(ok ? "revoked" : "no matching active key");
      return;
    }

    if (cmd === "workspaces") {
      const list = await stores.keys.listWorkspaces();
      console.log(
        JSON.stringify(
          list.map((w) => ({
            id: w.id,
            name: w.name,
            slug: w.slug,
            organization_id: w.organizationId,
            created_at: w.createdAt,
          })),
          null,
          2,
        ),
      );
      return;
    }

    if (cmd === "workspace-create") {
      const name = flag(rest, "name");
      if (!name) {
        console.error("Usage: keys workspace-create --name <name>");
        process.exit(1);
      }
      const ws = await stores.keys.createWorkspace({ name });
      console.log(JSON.stringify(ws, null, 2));
      return;
    }

    console.error(`Usage:
  pnpm keys create --name <name> [--workspace <id>]
  pnpm keys list [--workspace <id>]
  pnpm keys revoke --prefix <prefix> [--workspace <id>]
  pnpm keys workspaces
  pnpm keys workspace-create --name <name>
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

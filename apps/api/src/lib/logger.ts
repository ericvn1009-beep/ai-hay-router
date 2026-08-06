import { hostname } from "node:os";

export type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LoggerOptions {
  minLevel?: LogLevel;
  service?: string;
  instanceId?: string;
}

export function createLogger(
  minLevelOrOpts: LogLevel | LoggerOptions = "info",
) {
  const opts: LoggerOptions =
    typeof minLevelOrOpts === "string"
      ? { minLevel: minLevelOrOpts }
      : minLevelOrOpts;

  const minLevel = opts.minLevel ?? "info";
  const service = opts.service ?? "aihay-api";
  const instanceId = opts.instanceId ?? process.env.HOSTNAME ?? hostname();

  const base = {
    service,
    instance_id: instanceId,
  };

  function log(level: LogLevel, msg: string, fields?: Record<string, unknown>) {
    if (levelOrder[level] < levelOrder[minLevel]) return;
    const line = {
      level,
      msg,
      time: new Date().toISOString(),
      ...base,
      ...fields,
    };
    const out = JSON.stringify(line);
    if (level === "error") console.error(out);
    else if (level === "warn") console.warn(out);
    else console.log(out);
  }

  return {
    debug: (msg: string, fields?: Record<string, unknown>) => log("debug", msg, fields),
    info: (msg: string, fields?: Record<string, unknown>) => log("info", msg, fields),
    warn: (msg: string, fields?: Record<string, unknown>) => log("warn", msg, fields),
    error: (msg: string, fields?: Record<string, unknown>) => log("error", msg, fields),
    child(extra: Record<string, unknown>) {
      return {
        debug: (msg: string, fields?: Record<string, unknown>) =>
          log("debug", msg, { ...extra, ...fields }),
        info: (msg: string, fields?: Record<string, unknown>) =>
          log("info", msg, { ...extra, ...fields }),
        warn: (msg: string, fields?: Record<string, unknown>) =>
          log("warn", msg, { ...extra, ...fields }),
        error: (msg: string, fields?: Record<string, unknown>) =>
          log("error", msg, { ...extra, ...fields }),
      };
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;

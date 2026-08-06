export type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function createLogger(minLevel: LogLevel = "info") {
  function log(level: LogLevel, msg: string, fields?: Record<string, unknown>) {
    if (levelOrder[level] < levelOrder[minLevel]) return;
    const line = {
      level,
      msg,
      time: new Date().toISOString(),
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
  };
}

export type Logger = ReturnType<typeof createLogger>;

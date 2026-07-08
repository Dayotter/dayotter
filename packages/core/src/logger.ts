/**
 * Minimal zero-dependency structured logger. Emits one JSON object per line with
 * a level, message, timestamp, and arbitrary context — greppable and ready for
 * any log aggregator. Use `logger.child({...})` to bind context (e.g. a request
 * or job id) that's included on every subsequent line.
 */

type Level = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const configured = (process.env.LOG_LEVEL as Level) ?? "info";
  return LEVELS[configured] ?? LEVELS.info;
}

/** Expand an Error anywhere in the context into a serialisable shape. */
function normalize(ctx: LogContext): LogContext {
  const out: LogContext = {};
  for (const [k, v] of Object.entries(ctx)) {
    out[k] =
      v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v;
  }
  return out;
}

class Logger {
  constructor(private readonly base: LogContext = {}) {}

  /** Return a logger that includes `ctx` on every line (e.g. request/job ids). */
  child(ctx: LogContext): Logger {
    return new Logger({ ...this.base, ...ctx });
  }

  private emit(level: Level, msg: string, ctx?: LogContext): void {
    if (LEVELS[level] < threshold()) return;
    const line = JSON.stringify({
      level,
      msg,
      time: new Date().toISOString(),
      ...normalize({ ...this.base, ...ctx }),
    });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }

  debug(msg: string, ctx?: LogContext) {
    this.emit("debug", msg, ctx);
  }
  info(msg: string, ctx?: LogContext) {
    this.emit("info", msg, ctx);
  }
  warn(msg: string, ctx?: LogContext) {
    this.emit("warn", msg, ctx);
  }
  error(msg: string, ctx?: LogContext) {
    this.emit("error", msg, ctx);
  }
}

export const logger = new Logger();

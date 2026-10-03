import { getServerConfig } from "@/shared/config/server";

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Intent: Define log severity levels for filtering.
const tiers: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

/**
 * @interface LogPayload
 * @description Flexible key-value structure for structured logging data.
 */
interface LogPayload {
    [key: string]: any;
}

/**
 * Current threshold. Read lazily from the validated config; if the config itself is
 * invalid the logger must still work (it is how that failure gets reported), so fall
 * back to `info`.
 */
function currentTier(): number {
    try {
        return tiers[getServerConfig().logLevel];
    } catch {
        return tiers.info;
    }
}

function serializeError(err: Error): Record<string, unknown> {
    const out: Record<string, unknown> = { name: err.name, message: err.message, stack: err.stack };
    const code = (err as { code?: unknown }).code;
    if (code !== undefined) out.code = code;
    if (err.cause !== undefined) out.cause = err.cause instanceof Error ? serializeError(err.cause) : err.cause;
    return out;
}

/** JSON.stringify that turns Errors into plain objects and cuts circular references. */
function safeStringify(entry: Record<string, unknown>): string {
    const seen = new WeakSet<object>();
    return JSON.stringify(entry, (_key, value) => {
        if (value instanceof Error) return serializeError(value);
        if (typeof value === 'bigint') return value.toString();
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);
        }
        return value;
    });
}

const RESERVED = new Set(['ts', 'level', 'ctx', 'msg']);

/**
 * @class Logger
 * @description Centralized structured logging utility.
 * Emits one JSON object per line: `{ ts, level, ctx, msg, ...bindings, ...data }`,
 * suitable for Vercel and Docker log collectors. Level comes from `LOG_LEVEL` via the
 * server config.
 */
class Logger {
    private readonly context: string;
    private readonly bindings: LogPayload;

    constructor(context: string = 'App', bindings: LogPayload = {}) {
        this.context = context;
        this.bindings = bindings;
    }

    // Factory method for creating context-aware loggers
    static get(context: string) {
        return new Logger(context);
    }

    /** Child logger that adds `requestId` to every line it writes. */
    withRequestId(id: string): Logger {
        return new Logger(this.context, { ...this.bindings, requestId: id });
    }

    private shouldLog(level: LogLevel): boolean {
        return tiers[level] >= currentTier();
    }

    private format(level: LogLevel, message: string, data?: LogPayload): string {
        const entry: Record<string, unknown> = {
            ts: new Date().toISOString(),
            level,
            ctx: this.context,
            msg: message,
        };
        // Payload keys never overwrite the reserved fields above.
        for (const source of [this.bindings, data ?? {}]) {
            for (const [key, value] of Object.entries(source)) {
                if (!RESERVED.has(key)) entry[key] = value;
            }
        }
        try {
            return safeStringify(entry);
        } catch {
            return JSON.stringify({ ts: entry.ts, level, ctx: this.context, msg: message, note: 'unserializable data' });
        }
    }

    debug(message: string, data?: LogPayload) {
        if (this.shouldLog('debug')) {
            console.debug(this.format('debug', message, data));
        }
    }

    info(message: string, data?: LogPayload) {
        if (this.shouldLog('info')) {
            console.info(this.format('info', message, data));
        }
    }

    warn(message: string, data?: LogPayload) {
        if (this.shouldLog('warn')) {
            console.warn(this.format('warn', message, data));
        }
    }

    error(message: string, data?: LogPayload | Error) {
        if (this.shouldLog('error')) {
            // Normalize Error objects to payloads
            const payload = data instanceof Error ? { error: data } : data;
            console.error(this.format('error', message, payload));
        }
    }
}

// Export a default instance for quick usage
export const logger = new Logger();

// Export class for creating named instances
export default Logger;

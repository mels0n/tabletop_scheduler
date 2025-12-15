export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Intent: Define log severity levels for filtering.
const tiers: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

// Check environment variable (default to 'info')
// Intent: Allows runtime configuration of log verbosity.
const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const currentTier = tiers[currentLevel] ?? 1;

/**
 * @interface LogPayload
 * @description Flexible key-value structure for structured logging data.
 */
interface LogPayload {
    [key: string]: any;
}

/**
 * @class Logger
 * @description Centralized structured logging utility.
 * Features:
 * 1. Context-aware logging (e.g., "[Database]", "[Auth]").
 * 2. structured JSON logging via console (compatible with cloud log aggregators).
 * 3. Log level filtering based on environment variables.
 * 4. Safe error serialization (handles circular references).
 */
class Logger {
    private context: string;

    constructor(context: string = 'App') {
        this.context = context;
    }

    // Factory method for creating context-aware loggers
    static get(context: string) {
        return new Logger(context);
    }

    /**
     * Determines if a message should be emitted based on the current log level config.
     */
    private shouldLog(level: LogLevel): boolean {
        return tiers[level] >= currentTier;
    }

    /**
     * Formats the log message into a consistent string structure.
     * Tries to serialize the 'data' payload safely.
     */
    private format(level: LogLevel, message: string, data?: LogPayload) {
        const timestamp = new Date().toISOString();
        const contextStr = `[${this.context}]`;
        const levelStr = level.toUpperCase().padEnd(5); // "INFO "

        let output = `${timestamp} ${levelStr} ${contextStr} ${message}`;

        if (data) {
            // Keep data structured but safe
            try {
                // If data contains an Error object, format it nicely
                if (data instanceof Error) {
                    output += `\nStack: ${data.stack}`;
                } else if ('error' in data && data.error instanceof Error) {
                    output += `\nStack: ${data.error.stack}`;
                }

                output += ` ${JSON.stringify(data)}`;
            } catch (e) {
                output += ` [Circular/Unserializable Data]`;
            }
        }

        return output;
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

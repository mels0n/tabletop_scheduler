import { z } from "zod";
// Imported from the class file directly: the errors index pulls in the logger,
// and the logger reads this config.
import { ConfigError } from "@/shared/errors/errors";

/**
 * Single validated source for server-side configuration. Parsed once on first use and
 * cached; `instrumentation.ts` calls it at boot so a bad environment fails fast.
 * Client code must use `shared/config/public.ts` instead.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type TelegramMode = "webhook" | "polling" | "off";

export interface ServerConfig {
    nodeEnv: "development" | "test" | "production";
    isHosted: boolean;
    isVercel: boolean;
    /** Canonical public origin without a trailing slash, or null when unset. */
    baseUrl: string | null;
    sessionSecret: string;
    cronSecret: string | null;
    telegram: { token: string | null; mode: TelegramMode };
    discord: { botToken: string | null; appId: string | null; clientSecret: string | null };
    kofiVerificationToken: string | null;
    logLevel: LogLevel;
    cleanupRetentionDays: { finalized: number; draft: number; cancelled: number };
    acceptDataLoss: boolean;
}

const DEV_SESSION_SECRET = "dev-session-secret";
const BUILD_PHASE = "phase-production-build";
const BASE_URL_REQUIRED = "NEXT_PUBLIC_BASE_URL is required when a bot token is configured";

/** Empty or whitespace-only env values are treated as unset. */
const optionalString = z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined),
    z.string().optional(),
);

const flag = optionalString.transform((v) => v === "true" || v === "1");

const retentionDays = (fallback: number) =>
    optionalString.pipe(
        z.string()
            .regex(/^\d+$/, "must be a whole number of days")
            .transform(Number)
            .optional()
            .default(fallback),
    );

const baseUrl = optionalString.pipe(
    z.string()
        .refine((v) => {
            try {
                const u = new URL(v);
                return u.protocol === "https:" || u.protocol === "http:";
            } catch {
                return false;
            }
        }, "must be an absolute http(s) URL")
        .transform((v) => v.replace(/\/+$/, ""))
        .optional(),
);

const envSchema = z.object({
    NODE_ENV: optionalString.pipe(z.enum(["development", "test", "production"]).optional().default("development")),
    NEXT_PUBLIC_IS_HOSTED: optionalString.transform((v) => v === "true"),
    VERCEL: flag,
    NEXT_PUBLIC_BASE_URL: baseUrl,
    SESSION_SECRET: optionalString,
    CRON_SECRET: optionalString,
    TELEGRAM_BOT_TOKEN: optionalString,
    TELEGRAM_MODE: optionalString.pipe(z.enum(["webhook", "polling", "off"]).optional()),
    DISCORD_BOT_TOKEN: optionalString,
    DISCORD_APP_ID: optionalString,
    DISCORD_CLIENT_SECRET: optionalString,
    KOFI_VERIFICATION_TOKEN: optionalString,
    LOG_LEVEL: optionalString.pipe(
        z.string().toLowerCase().pipe(z.enum(["debug", "info", "warn", "error"])).optional().default("info"),
    ),
    CLEANUP_RETENTION_DAYS_FINALIZED: retentionDays(1),
    CLEANUP_RETENTION_DAYS_DRAFT: retentionDays(30),
    CLEANUP_RETENTION_DAYS_CANCELLED: retentionDays(7),
    PRISMA_ACCEPT_DATA_LOSS: flag,
    NEXT_PHASE: optionalString,
});

function loadServerConfig(env: NodeJS.ProcessEnv): ServerConfig {
    const parsed = envSchema.safeParse(env);
    if (!parsed.success) {
        const problems = parsed.error.issues.map((i) => `${i.path.join(".") || "env"}: ${i.message}`);
        throw new ConfigError(`Invalid server configuration:\n- ${problems.join("\n- ")}`);
    }
    const e = parsed.data;

    // `next build` evaluates server modules without runtime secrets; presence rules apply at runtime only.
    const isBuild = e.NEXT_PHASE === BUILD_PHASE;
    const problems: string[] = [];

    const telegramToken = e.TELEGRAM_BOT_TOKEN ?? null;
    const discordToken = e.DISCORD_BOT_TOKEN ?? null;
    const resolvedBaseUrl = e.NEXT_PUBLIC_BASE_URL ?? null;

    let telegramMode: TelegramMode;
    if (!telegramToken) telegramMode = "off";
    else if (e.TELEGRAM_MODE) telegramMode = e.TELEGRAM_MODE;
    else if (telegramToken && resolvedBaseUrl) telegramMode = "webhook";
    else if (telegramToken && !e.VERCEL) telegramMode = "polling";
    else telegramMode = "off";

    if (!isBuild) {
        if (e.NODE_ENV === "production" && !e.SESSION_SECRET) {
            problems.push("SESSION_SECRET: required in production");
        }
        if ((e.NEXT_PUBLIC_IS_HOSTED || e.VERCEL) && !e.CRON_SECRET) {
            problems.push("CRON_SECRET: required when hosted or on Vercel");
        }
        if (telegramMode === "polling" && e.VERCEL) {
            problems.push("TELEGRAM_MODE: polling is not supported on Vercel; use webhook");
        }
        // Every bot sends absolute links (logins, events, reminders, recovery), so the base URL
        // is required in every Telegram mode, polling included.
        if ((telegramToken || discordToken) && !resolvedBaseUrl) {
            problems.push(BASE_URL_REQUIRED);
        }
    }

    if (problems.length > 0) {
        throw new ConfigError(`Invalid server configuration:\n- ${problems.join("\n- ")}`);
    }

    return {
        nodeEnv: e.NODE_ENV,
        isHosted: e.NEXT_PUBLIC_IS_HOSTED,
        isVercel: e.VERCEL,
        baseUrl: resolvedBaseUrl,
        sessionSecret: e.SESSION_SECRET ?? DEV_SESSION_SECRET,
        cronSecret: e.CRON_SECRET ?? null,
        telegram: { token: telegramToken, mode: telegramMode },
        discord: {
            botToken: discordToken,
            appId: e.DISCORD_APP_ID ?? null,
            clientSecret: e.DISCORD_CLIENT_SECRET ?? null,
        },
        kofiVerificationToken: e.KOFI_VERIFICATION_TOKEN ?? null,
        logLevel: e.LOG_LEVEL,
        cleanupRetentionDays: {
            finalized: e.CLEANUP_RETENTION_DAYS_FINALIZED,
            draft: e.CLEANUP_RETENTION_DAYS_DRAFT,
            cancelled: e.CLEANUP_RETENTION_DAYS_CANCELLED,
        },
        acceptDataLoss: e.PRISMA_ACCEPT_DATA_LOSS,
    };
}

let cached: ServerConfig | null = null;

/** Returns the validated server config, parsing `process.env` on first call. Throws `ConfigError`. */
export function getServerConfig(): ServerConfig {
    if (!cached) cached = loadServerConfig(process.env);
    return cached;
}

/** Drops the cached config so the next `getServerConfig()` re-reads `process.env`. Tests only. */
export function resetServerConfigForTests(): void {
    cached = null;
}

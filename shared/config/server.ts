import { createHmac, randomBytes } from "node:crypto";
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
    /** Minimum minutes between two "updated their availability" group posts for one participant. 0 = no cooldown. */
    voteAnnounceCooldownMinutes: number;
    /**
     * Self-host only: outbound webhooks may use plain http and private, loopback or link-local
     * addresses. Always false when hosted or on Vercel, whatever the environment says.
     */
    webhookAllowPrivate: boolean;
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

const cooldownMinutes = (fallback: number) =>
    optionalString.pipe(
        z.string()
            .regex(/^\d+$/, "must be a whole number of minutes")
            .transform(Number)
            .pipe(z.number().max(1440, "must be between 0 and 1440 minutes"))
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
    VERCEL_ENV: optionalString,
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
    CLEANUP_RETENTION_DAYS_DRAFT: retentionDays(1),
    CLEANUP_RETENTION_DAYS_CANCELLED: retentionDays(1),
    PRISMA_ACCEPT_DATA_LOSS: flag,
    VOTE_ANNOUNCE_COOLDOWN_MINUTES: cooldownMinutes(60),
    WEBHOOK_ALLOW_PRIVATE: flag,
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

    // Hosted and Vercel deployments always have a public URL, so they default to webhook.
    // Anywhere else defaults to polling, which needs no inbound route; a self-host install
    // with a public URL opts in to webhook with TELEGRAM_MODE=webhook.
    const hostedOrVercel = e.NEXT_PUBLIC_IS_HOSTED || e.VERCEL;
    let telegramMode: TelegramMode;
    if (!telegramToken) telegramMode = "off";
    else if (e.TELEGRAM_MODE) telegramMode = e.TELEGRAM_MODE;
    else telegramMode = hostedOrVercel ? "webhook" : "polling";

    if (!isBuild) {
        if (sessionSecretRequired(e) && !e.SESSION_SECRET) {
            problems.push("SESSION_SECRET: required in production (Vercel production or a non-Vercel production server)");
        }
        if ((e.NEXT_PUBLIC_IS_HOSTED || isVercelProduction(e)) && !e.CRON_SECRET) {
            problems.push("CRON_SECRET: required when hosted or on Vercel production");
        }
        if (telegramMode === "polling" && e.VERCEL) {
            problems.push("TELEGRAM_MODE: polling is not supported on Vercel; use webhook");
        }
        // Every bot sends absolute links (logins, events, reminders, recovery). Hosted and Vercel
        // fail boot without the base URL; a self-host install stays up and instrumentation logs
        // an error, so an upgrade that predates this variable does not crash-loop.
        if (hostedOrVercel && (telegramToken || discordToken) && !resolvedBaseUrl) {
            problems.push(BASE_URL_REQUIRED);
        }
    }

    if (problems.length > 0) {
        throw new ConfigError(`Invalid server configuration:\n- ${problems.join("\n- ")}`);
    }

    const sessionSecret = e.SESSION_SECRET ?? fallbackSessionSecret(e, isBuild);

    return {
        nodeEnv: e.NODE_ENV,
        isHosted: e.NEXT_PUBLIC_IS_HOSTED,
        isVercel: e.VERCEL,
        baseUrl: resolvedBaseUrl,
        sessionSecret,
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
        voteAnnounceCooldownMinutes: e.VOTE_ANNOUNCE_COOLDOWN_MINUTES,
        webhookAllowPrivate: e.WEBHOOK_ALLOW_PRIVATE && !hostedOrVercel,
    };
}

type ParsedEnv = z.infer<typeof envSchema>;

function isVercelProduction(e: ParsedEnv): boolean {
    return e.VERCEL_ENV === "production";
}

/** Vercel production, or a production server that is not on Vercel (Docker, bare Node). */
function sessionSecretRequired(e: ParsedEnv): boolean {
    return isVercelProduction(e) || (!e.VERCEL && e.NODE_ENV === "production");
}

let previewSecret: string | null = null;

/**
 * The secret used when SESSION_SECRET is unset and not required. A Vercel Preview (or
 * development) deployment gets an ephemeral value: derived per deployment from CRON_SECRET
 * when one is set, otherwise random per process. Either way it is never a value known in
 * advance, and one warning is logged. Local development and tests use a fixed dev secret.
 */
function fallbackSessionSecret(e: ParsedEnv, isBuild: boolean): string {
    if (!e.VERCEL || isBuild) return DEV_SESSION_SECRET;
    if (!previewSecret) {
        previewSecret = e.CRON_SECRET
            ? createHmac("sha256", e.CRON_SECRET).update(`preview-session:${process.env.VERCEL_DEPLOYMENT_ID ?? ""}`).digest("hex")
            : randomBytes(32).toString("hex");
        // The logger reads this config, so this one warning goes straight to the console.
        console.warn(JSON.stringify({
            level: "warn",
            context: "Config",
            message: "SESSION_SECRET is unset on a Vercel non-production deployment; using an ephemeral secret, so sessions may not survive a redeploy",
        }));
    }
    return previewSecret;
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
    previewSecret = null;
}

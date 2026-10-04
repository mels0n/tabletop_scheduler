import { vi } from 'vitest';

/**
 * Every env key the server config reads. Tests stub all of them to empty (treated as
 * unset) and then apply overrides, so a developer's local `.env` cannot change results.
 */
const CONFIG_KEYS = [
    'NEXT_PUBLIC_IS_HOSTED',
    'VERCEL',
    'VERCEL_ENV',
    'VERCEL_DEPLOYMENT_ID',
    'NEXT_PUBLIC_BASE_URL',
    'SESSION_SECRET',
    'CRON_SECRET',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_MODE',
    'DISCORD_BOT_TOKEN',
    'DISCORD_APP_ID',
    'DISCORD_CLIENT_SECRET',
    'KOFI_VERIFICATION_TOKEN',
    'LOG_LEVEL',
    'CLEANUP_RETENTION_DAYS_FINALIZED',
    'CLEANUP_RETENTION_DAYS_DRAFT',
    'CLEANUP_RETENTION_DAYS_CANCELLED',
    'PRISMA_ACCEPT_DATA_LOSS',
    'VOTE_ANNOUNCE_COOLDOWN_MINUTES',
    'WEBHOOK_ALLOW_PRIVATE',
    'NEXT_PHASE',
] as const;

/** Test helper: reset every config env key, then apply `overrides`. Undo with `vi.unstubAllEnvs()`. */
export function stubConfigEnv(overrides: Record<string, string> = {}): void {
    vi.stubEnv('NODE_ENV', 'test');
    for (const key of CONFIG_KEYS) vi.stubEnv(key, '');
    for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value);
}

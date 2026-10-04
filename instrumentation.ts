/**
 * @file instrumentation.ts
 * @description Next.js Instrumentation hook. Runs once when the server starts: validates
 * configuration and sets up Telegram delivery according to `TELEGRAM_MODE`.
 */

/**
 * Registers the instrumentation hook.
 *
 * @returns {Promise<void>}
 */
export async function register() {
    // Intent: Ensure code only runs in the Node.js runtime, not Edge or Browser.
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Validate configuration first. A ConfigError must fail boot, so it is not
        // caught by the non-fatal handler below.
        const { getServerConfig } = await import("@/shared/config/server");
        const config = getServerConfig();
        const { default: Logger } = await import("@/shared/lib/logger");
        const log = Logger.get("Instrumentation");

        // Self-host boots without a base URL (hosted and Vercel refuse to); the bots still run
        // but every link they send needs it, so say so loudly instead of failing boot.
        if ((config.telegram.token || config.discord.botToken) && !config.baseUrl) {
            log.error("A bot token is set but NEXT_PUBLIC_BASE_URL is not; bot links will fail until NEXT_PUBLIC_BASE_URL is set");
        }

        try {
            const { token, mode } = config.telegram;
            // Reminder scheduling is handled by an external cron (start.sh loop, pg_cron, or
            // the GitHub workflow), not here, so ephemeral containers stay stateless.

            if (token && mode === "webhook" && config.baseUrl) {
                // Awaited so a serverless runtime does not freeze the process mid-request.
                // One getWebhookInfo read per cold start; setWebhook only when it differs.
                const { syncWebhook } = await import("@/features/telegram");
                const ok = await syncWebhook(config.baseUrl, token).catch((e) => {
                    log.error("Telegram webhook setup error", e as Error);
                    return false;
                });
                if (!ok) log.error("Failed to configure the Telegram webhook");
            } else if (token && mode === "webhook") {
                log.error("TELEGRAM_MODE=webhook needs NEXT_PUBLIC_BASE_URL; Telegram is not configured");
            } else if (token && mode === "polling") {
                const { startPolling } = await import("@/features/telegram");
                // Not awaited: the loop runs for the life of the process.
                startPolling().catch((err) => {
                    log.error("Failed to start the Telegram poller", err as Error);
                });
            }
            // mode "off": nothing to do.
        } catch (error) {
            // Telegram setup is non-fatal: the web app must still boot.
            log.error("Instrumentation hook failed (non-fatal)", error as Error);
        }
    }
}

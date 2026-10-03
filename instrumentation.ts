/**
 * @file instrumentation.ts
 * @description Next.js Instrumentation hook.
 * This file allows us to execute code once when the server starts, used here to initialize Telegram bot connectivity.
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
        getServerConfig();

        try {
            const token = process.env.TELEGRAM_BOT_TOKEN;
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

            if (token) {
                // Note: Reminder scheduling is handled by an external cron service (e.g., start.sh loop or Vercel Cron)
                // to ensure reliability across ephemeral container deployments.

                // Intent: Configure Telegram Connectivity based on environment.
                // Presence of BASE_URL implies a public endpoint suitable for Webhooks.
                if (baseUrl) {
                    console.log(`🚀 Base URL detected (${baseUrl}). Configuring Telegram Webhook...`);
                    const { ensureWebhook } = await import("@/features/telegram");
                    // Intent: Await execution to ensure Vercel/Lambda doesn't freeze the process before completion.
                    const success = await ensureWebhook(baseUrl, token).catch(e => {
                        console.error("❌ Telegram Webhook Setup Error:", e);
                        return false;
                    });
                    if (success) console.log("✅ Telegram Webhook configured.");
                    else console.error("❌ Failed to configure Telegram Webhook.");
                }
                // Intent: Fallback to Long Polling if no Base URL is explicitly defined (e.g., Localhost dev).
                else {
                    console.log("🤖 No Base URL found. Initializing Poller (Default Mode)...");
                    const { startPolling } = await import("@/features/telegram");
                    // Do not await polling loop, it runs forever. Just catch startup errors.
                    startPolling().catch(err => {
                        console.error("❌ Failed to start Telegram Poller:", err);
                    });
                }
            }
        } catch (error) {
            // CRITICAL: Swallow instrumentation errors to prevent Server Boot Crash.
            // This prevents "undefined (reading 'workers')" from taking down the app.
            console.error("⚠️ Instrumentation Hook Failed (Non-Fatal):", error);
        }
    }
}

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
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

        if (token) {
            // Note: Reminder scheduling is handled by an external cron service (e.g., start.sh loop or Vercel Cron)
            // to ensure reliability across ephemeral container deployments.

            // Intent: Configure Telegram Connectivity based on environment.
            // Presence of BASE_URL implies a public endpoint suitable for Webhooks.
            if (baseUrl) {
                console.log(`🚀 Base URL detected (${baseUrl}). Configuring Telegram Webhook...`);
                try {
                    const { ensureWebhook } = await import("@/lib/telegram");
                    // Intent: Await execution to ensure Vercel/Lambda doesn't freeze the process before completion.
                    const success = await ensureWebhook(baseUrl, token);
                    if (success) console.log("✅ Telegram Webhook configured.");
                    else console.error("❌ Failed to configure Telegram Webhook.");
                } catch (err) {
                    console.error("❌ Failed to import/run ensureWebhook:", err);
                }
            }
            // Intent: Fallback to Long Polling if no Base URL is explicitly defined (e.g., Localhost dev).
            else {
                console.log("🤖 No Base URL found. Initializing Poller (Default Mode)...");
                try {
                    const { startPolling } = await import("./lib/telegram-poller");
                    startPolling();
                } catch (err) {
                    console.error("❌ Failed to start Telegram Poller:", err);
                }
            }
        }
    }
}

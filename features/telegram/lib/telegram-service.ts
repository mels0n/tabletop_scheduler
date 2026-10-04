import Logger from "@/shared/lib/logger";
import { getServerConfig } from "@/shared/config/server";
import { telegramUpdateSchema } from "../model/types";
import { handleTelegramUpdate } from "../server/update-handler";

const log = Logger.get("TelegramService");

const RETRY_DELAY_MS = 5000;

// Singleton polling state for this process.
let isPolling = false;
let lastUpdateId = 0;

/**
 * Long-polling transport for self-hosted installs without a public URL
 * (`TELEGRAM_MODE=polling`). Updates go to the same `handleTelegramUpdate` the webhook uses.
 *
 * Safety rules:
 * - Refuses to start on Vercel: every lambda would run its own poller.
 * - Exactly one loop per process.
 * - Never deletes a webhook. A 409 means a webhook is registered or another poller owns
 *   the bot; the loop logs once and stops instead of taking production offline.
 */
export async function startPolling(): Promise<void> {
    const config = getServerConfig();
    if (config.isVercel) {
        log.error("Telegram polling refused on Vercel. Use TELEGRAM_MODE=webhook.");
        return;
    }
    if (isPolling) {
        log.warn("Polling already started.");
        return;
    }
    const token = config.telegram.token;
    if (!token) {
        log.warn("Token not found. Polling skipped.");
        return;
    }

    isPolling = true;
    log.info("Starting Telegram long polling");
    void pollLoop(token);
}

/** Stops the loop after its current request. */
export function stopPolling(): void {
    isPolling = false;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function pollLoop(token: string): Promise<void> {
    while (isPolling) {
        try {
            const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
            const res = await fetch(url);

            if (res.status === 409) {
                const body = (await res.json().catch(() => ({}))) as { description?: string };
                log.error(
                    "Telegram polling stopped: another consumer owns this bot " +
                    `(${body.description ?? "409 Conflict"}). A registered webhook or a second poller is active. ` +
                    "This poller never deletes a webhook; set TELEGRAM_MODE to match the deployment, " +
                    "or delete the webhook yourself if this install should poll."
                );
                isPolling = false;
                return;
            }
            if (!res.ok) throw new Error(`Telegram API error: ${res.status} ${res.statusText}`);

            const data = (await res.json()) as { ok?: boolean; result?: unknown[] };
            for (const raw of data.ok ? data.result ?? [] : []) {
                const parsed = telegramUpdateSchema.safeParse(raw);
                if (!parsed.success) {
                    log.warn("Skipping malformed Telegram update");
                    const id = (raw as { update_id?: unknown })?.update_id;
                    if (typeof id === "number") lastUpdateId = Math.max(lastUpdateId, id);
                    continue;
                }
                lastUpdateId = Math.max(lastUpdateId, parsed.data.update_id);
                try {
                    await handleTelegramUpdate(parsed.data);
                } catch (e) {
                    log.error("Error processing Telegram update", e as Error);
                }
            }
        } catch (error) {
            log.error(`Polling error (retrying in ${RETRY_DELAY_MS / 1000}s)`, error as Error);
            await sleep(RETRY_DELAY_MS);
        }
    }
}

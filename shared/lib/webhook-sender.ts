import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";

const log = Logger.get("WebhookSender");

/**
 * Processes a single webhook event.
 * Handles the actual HTTP request and updates the database status.
 * 
 * @param webhookId - The UUID of the WebhookEvent to process
 * @returns Object containing the result status
 */
export async function processWebhook(webhookId: string) {
    const webhook = await prisma.webhookEvent.findUnique({
        where: { id: webhookId }
    });

    if (!webhook) {
        log.warn("Webhook not found", { webhookId });
        return { success: false, error: "Webhook not found" };
    }

    try {
        log.info("Attempting webhook delivery", { id: webhookId, url: webhook.url, attempt: webhook.attempts + 1 });

        const res = await fetch(webhook.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Tabletop-Event-Id": webhook.eventId.toString(),
                "X-Webhook-Id": webhook.id
            },
            body: webhook.payload,
            signal: AbortSignal.timeout(10000) // 10s timeout per request
        });

        if (res.ok) {
            // Success
            await prisma.webhookEvent.update({
                where: { id: webhookId },
                data: {
                    status: "DELIVERED",
                    attempts: { increment: 1 }
                }
            });
            log.info("Webhook delivered successfully", { id: webhookId });
            return { success: true, status: "DELIVERED" };
        } else {
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }

    } catch (error) {
        // Failure Handling
        const attempts = webhook.attempts + 1;
        const now = new Date();

        // Policy: Check if we've exceeded 1 hour from creation
        // 1 Hour = 60 mins = 3600000 ms
        const age = now.getTime() - webhook.createdAt.getTime();
        const TIMEOUT_MS = 60 * 60 * 1000;

        let newStatus = "RETRY";
        let nextTime = new Date(now.getTime() + 5 * 60 * 1000); // Default 5 min retry

        if (age > TIMEOUT_MS) {
            newStatus = "FAILED";
            // Keep nextTime as is or null, doesn't matter much if failed, but let's just leave it logic-less
        }

        await prisma.webhookEvent.update({
            where: { id: webhookId },
            data: {
                status: newStatus,
                attempts: attempts,
                nextAttempt: newStatus === "RETRY" ? nextTime : undefined
            }
        });

        log.warn("Webhook delivery failed", { id: webhookId, error: String(error), status: newStatus });
        return { success: false, status: newStatus, error: String(error) };
    }
}

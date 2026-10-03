import { getServerConfig } from "@/shared/config/server";
import { signWebhookBody } from "./signature";

const TIMEOUT_MS = 10_000;

export interface OutboxRow {
    id: string;
    eventId: number;
    url: string;
    payload: string;
}

/**
 * Performs one signed POST for a queued webhook row. Resolves on a 2xx response and throws
 * otherwise (non-2xx, redirect, network error, timeout). Never touches the database: the
 * cron route owns claiming and status transitions.
 */
export async function deliverWebhook(row: OutboxRow): Promise<void> {
    const { cronSecret } = getServerConfig();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Tabletop-Event-Id": String(row.eventId),
        "X-Webhook-Id": row.id,
    };
    if (cronSecret) headers["X-Tabletop-Signature"] = signWebhookBody(row.payload, cronSecret);

    const res = await fetch(row.url, {
        method: "POST",
        headers,
        body: row.payload,
        redirect: "manual", // a redirect is a failed attempt, never followed
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

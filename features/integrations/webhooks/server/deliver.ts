import { assertSafeWebhookUrl } from "@/shared/lib/webhook-sender";
import { signWebhookBody } from "./signature";

const TIMEOUT_MS = 10_000;

export interface OutboxRow {
    id: string;
    eventId: number;
    url: string;
    payload: string;
}

/**
 * The destination was refused before any request was made: not https, carries credentials,
 * or resolves to a private, loopback or link-local address. The cron marks the row FAILED
 * at once instead of retrying it.
 */
export class WebhookRefusedError extends Error {
    constructor(reason: string) {
        super(reason);
        this.name = "WebhookRefusedError";
    }
}

/**
 * The only outbound HTTP path for a queued webhook row. Re-checks the destination
 * (`assertSafeWebhookUrl`, so a host that now resolves to a private address is refused),
 * then performs one POST, always signed with `X-Tabletop-Signature` (see `signWebhookBody`).
 * Redirects are never followed and the request is abandoned after 10 seconds.
 *
 * Resolves on a 2xx response. Throws `WebhookRefusedError` for a refused destination and a
 * plain `Error` otherwise (non-2xx, redirect, network error, timeout). Never touches the
 * database: the cron route owns claiming and status transitions.
 */
export async function deliverWebhook(row: OutboxRow): Promise<void> {
    try {
        await assertSafeWebhookUrl(row.url);
    } catch (error) {
        throw new WebhookRefusedError((error as Error).message);
    }

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Tabletop-Event-Id": String(row.eventId),
        "X-Webhook-Id": row.id,
        "X-Tabletop-Signature": signWebhookBody(row.payload),
    };

    const res = await fetch(row.url, {
        method: "POST",
        headers,
        body: row.payload,
        redirect: "manual", // a 3xx could point back at a private host: a failed attempt, never followed
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

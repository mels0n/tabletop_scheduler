import { createHmac } from "node:crypto";

/**
 * Value for the `X-Tabletop-Signature` header: `sha256=<hex HMAC-SHA256 of the raw body>`,
 * keyed with `CRON_SECRET`. Receivers must verify against the exact bytes sent.
 */
export function signWebhookBody(raw: string, secret: string): string {
    return "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
}

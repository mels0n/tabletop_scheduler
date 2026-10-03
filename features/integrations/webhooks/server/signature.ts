import { createHmac } from "node:crypto";
import { getServerConfig } from "@/shared/config/server";

/**
 * Value for the `X-Tabletop-Signature` header: `sha256=<hex HMAC-SHA256 of the raw body>`,
 * keyed with the instance's `webhookSigningKey` (hex HMAC-SHA256 of `webhook-signing` keyed
 * with `SESSION_SECRET`; the 64 hex characters are the key bytes). Receivers must verify
 * against the exact bytes sent.
 */
export function signWebhookBody(raw: string): string {
    const { webhookSigningKey } = getServerConfig();
    return "sha256=" + createHmac("sha256", webhookSigningKey).update(raw).digest("hex");
}

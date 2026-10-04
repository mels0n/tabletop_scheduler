import { createHmac } from "node:crypto";
import { getServerConfig } from "@/shared/config/server";

const WEBHOOK_SIGNING_CONTEXT = "webhook-signing";

/**
 * The signing key for one webhook destination: hex HMAC-SHA256 of
 * `"webhook-signing\0" + origin(url)`, keyed with `SESSION_SECRET`. Each destination origin
 * gets its own key, so an integrator holding theirs cannot forge deliveries that another
 * destination would accept. Independent of `CRON_SECRET`.
 */
export function webhookSigningKeyFor(url: string): string {
    const origin = new URL(url).origin;
    return createHmac("sha256", getServerConfig().sessionSecret)
        .update(`${WEBHOOK_SIGNING_CONTEXT}\0${origin}`, "utf8")
        .digest("hex");
}

/**
 * Value for the `X-Tabletop-Signature` header: `sha256=<hex HMAC-SHA256 of the raw body>`,
 * keyed with the destination's signing key (`webhookSigningKeyFor(url)`; the 64 hex
 * characters are the key bytes). Receivers must verify against the exact bytes sent.
 */
export function signWebhookBody(raw: string, url: string): string {
    return "sha256=" + createHmac("sha256", webhookSigningKeyFor(url)).update(raw).digest("hex");
}

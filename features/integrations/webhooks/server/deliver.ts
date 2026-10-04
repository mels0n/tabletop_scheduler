import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import type { LookupFunction } from "node:net";
import { resolveSafeWebhookTarget, WebhookHostUnresolvedError, type VettedAddress } from "@/shared/lib/webhook-sender";
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
 * A `lookup` for the socket that answers only with the addresses already vetted, so the
 * connection cannot land anywhere the check did not approve, whatever DNS says by then.
 * Host header and TLS SNI still come from the URL, so certificates verify as normal.
 */
function pinnedLookup(addresses: VettedAddress[]): LookupFunction {
    return (_hostname, options, callback) => {
        if (options.all) {
            callback(null, addresses.map(({ address, family }) => ({ address, family })));
            return;
        }
        const pick = addresses.find((a) => a.family === options.family) ?? addresses[0];
        callback(null, pick.address, pick.family);
    };
}

/**
 * One POST over a fresh socket to a vetted address. Resolves with the status code; never follows
 * redirects. Plain http only reaches here when `resolveSafeWebhookTarget` allowed it
 * (`WEBHOOK_ALLOW_PRIVATE` on a self-hosted install).
 */
function postPinned(target: URL, addresses: VettedAddress[], headers: Record<string, string>, body: string): Promise<number> {
    const request = target.protocol === "http:" ? httpRequest : httpsRequest;
    return new Promise((resolve, reject) => {
        const req = request(
            target,
            {
                method: "POST",
                headers: { ...headers, "Content-Length": String(Buffer.byteLength(body)) },
                lookup: pinnedLookup(addresses),
                agent: false, // no pooled socket from an earlier resolution
                signal: AbortSignal.timeout(TIMEOUT_MS),
            },
            (res) => {
                res.resume(); // the body is ignored; drain it so the socket closes
                resolve(res.statusCode ?? 0);
            },
        );
        req.on("error", reject);
        req.end(body);
    });
}

/**
 * The only outbound HTTP path for a queued webhook row. Resolves the destination once
 * (`resolveSafeWebhookTarget`: https, no credentials, every address public), then performs
 * one POST connected to exactly those vetted addresses, always signed with
 * `X-Tabletop-Signature` (see `signWebhookBody`). Redirects are never followed and the
 * request is abandoned after 10 seconds.
 *
 * Resolves on a 2xx response. Throws `WebhookRefusedError` for a refused destination (bad
 * protocol, credentials in the URL, a private address) and a plain `Error` otherwise
 * (host does not resolve, non-2xx, redirect, network error, timeout). Never touches the
 * database: the cron route owns claiming and status transitions.
 */
export async function deliverWebhook(row: OutboxRow): Promise<void> {
    let target: Awaited<ReturnType<typeof resolveSafeWebhookTarget>>;
    try {
        target = await resolveSafeWebhookTarget(row.url);
    } catch (error) {
        // DNS trouble is usually transient: a plain Error lets the cron retry it.
        if (error instanceof WebhookHostUnresolvedError) throw new Error(error.message, { cause: error });
        throw new WebhookRefusedError((error as Error).message);
    }

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Tabletop-Event-Id": String(row.eventId),
        "X-Webhook-Id": row.id,
        "X-Tabletop-Signature": signWebhookBody(row.payload, row.url),
    };

    const status = await postPinned(target.url, target.addresses, headers, row.payload);
    if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`);
}

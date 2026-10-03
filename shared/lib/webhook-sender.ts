import { createHmac } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { getServerConfig } from "@/shared/config/server";
import { ValidationError } from "@/shared/errors";

const log = Logger.get("WebhookSender");

const REQUEST_TIMEOUT_MS = 10_000;

/** IPv4 CIDR blocks a webhook may never reach: private, loopback, link-local, CGNAT, multicast, reserved. */
const BLOCKED_V4: ReadonlyArray<[number, number]> = [
    [0x00000000, 8],  // 0.0.0.0/8 ("this network", includes 0.0.0.0)
    [0x0a000000, 8],  // 10.0.0.0/8
    [0x64400000, 10], // 100.64.0.0/10 (carrier-grade NAT)
    [0x7f000000, 8],  // 127.0.0.0/8
    [0xa9fe0000, 16], // 169.254.0.0/16 (link-local, cloud metadata)
    [0xac100000, 12], // 172.16.0.0/12
    [0xc0a80000, 16], // 192.168.0.0/16
    [0xe0000000, 4],  // 224.0.0.0/4 multicast
    [0xf0000000, 4],  // 240.0.0.0/4 reserved and broadcast
];

function parseV4(ip: string): number | null {
    const parts = ip.split(".");
    if (parts.length !== 4) return null;
    let n = 0;
    for (const p of parts) {
        if (!/^\d{1,3}$/.test(p)) return null;
        const octet = Number(p);
        if (octet > 255) return null;
        n = n * 256 + octet;
    }
    return n;
}

function isBlockedV4(n: number): boolean {
    return BLOCKED_V4.some(([base, bits]) => {
        const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
        return ((n & mask) >>> 0) === base;
    });
}

/** Expands an IPv6 address (including `::` and an embedded dotted quad) into 8 hextets. */
function parseV6(ip: string): number[] | null {
    let addr = ip.toLowerCase();
    const zone = addr.indexOf("%");
    if (zone !== -1) addr = addr.slice(0, zone);

    // A trailing dotted quad (::ffff:127.0.0.1) becomes two hextets.
    const lastColon = addr.lastIndexOf(":");
    const tail = addr.slice(lastColon + 1);
    if (tail.includes(".")) {
        const v4 = parseV4(tail);
        if (v4 === null) return null;
        addr = `${addr.slice(0, lastColon + 1)}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
    }

    const halves = addr.split("::");
    if (halves.length > 2) return null;
    const toHextets = (s: string) => (s === "" ? [] : s.split(":"));
    const head = toHextets(halves[0]);
    const rest = halves.length === 2 ? toHextets(halves[1]) : [];
    const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
    if (fill < 0) return null;
    const groups = [...head, ...Array(fill).fill("0"), ...rest];
    if (groups.length !== 8) return null;

    const out: number[] = [];
    for (const g of groups) {
        if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
        out.push(parseInt(g, 16));
    }
    return out;
}

/**
 * True for any address a server-side request must not reach: private, loopback, link-local,
 * unique-local, unspecified, and IPv4-mapped/compatible/NAT64 forms of blocked IPv4 ranges.
 * Unparseable input counts as private (fail closed).
 */
export function isPrivateAddress(ip: string): boolean {
    const family = isIP(ip);
    if (family === 4) {
        const n = parseV4(ip);
        return n === null || isBlockedV4(n);
    }
    if (family !== 6) return true;

    const h = parseV6(ip);
    if (!h) return true;

    const allZeroPrefix = (count: number) => h.slice(0, count).every((x) => x === 0);
    const embeddedV4 = ((h[6] << 16) | h[7]) >>> 0;

    if (allZeroPrefix(8)) return true;                               // :: unspecified
    if (allZeroPrefix(7) && h[7] === 1) return true;                 // ::1 loopback
    if (allZeroPrefix(5) && h[5] === 0xffff) return isBlockedV4(embeddedV4); // ::ffff:a.b.c.d mapped
    if (allZeroPrefix(6)) return isBlockedV4(embeddedV4);            // ::a.b.c.d compatible (deprecated)
    if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((x) => x === 0)) {
        return isBlockedV4(embeddedV4);                              // 64:ff9b::/96 NAT64
    }
    if ((h[0] & 0xfe00) === 0xfc00) return true;                     // fc00::/7 unique local
    if ((h[0] & 0xffc0) === 0xfe80) return true;                     // fe80::/10 link-local
    if ((h[0] & 0xff00) === 0xff00) return true;                     // ff00::/8 multicast
    return false;
}

/**
 * Throws `ValidationError` unless `url` is https and every address its host resolves to is
 * public. Called when an event is created with a callback URL and again before each delivery,
 * so a host that later re-points at a private address is still refused.
 */
export async function assertSafeWebhookUrl(url: string): Promise<void> {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new ValidationError("Webhook URL is not a valid URL");
    }
    if (parsed.protocol !== "https:") {
        throw new ValidationError("Webhook URL must use https");
    }
    if (parsed.username || parsed.password) {
        throw new ValidationError("Webhook URL must not contain credentials");
    }

    const host = parsed.hostname.replace(/^\[(.*)\]$/, "$1");
    let addresses: { address: string }[];
    try {
        addresses = await lookup(host, { all: true, verbatim: true });
    } catch {
        throw new ValidationError("Webhook URL host does not resolve");
    }
    if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
        throw new ValidationError("Webhook URL must resolve to a public address");
    }
}

/** `sha256=<hex HMAC-SHA256(secret, body)>`, keyed by CRON_SECRET when set, else SESSION_SECRET. */
export function signWebhookBody(body: string): string {
    const { cronSecret, sessionSecret } = getServerConfig();
    return `sha256=${createHmac("sha256", cronSecret ?? sessionSecret).update(body, "utf8").digest("hex")}`;
}

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
        await assertSafeWebhookUrl(webhook.url);
    } catch (error) {
        // A destination that is (or now resolves to) a private address is never retried.
        await prisma.webhookEvent.update({
            where: { id: webhookId },
            data: { status: "FAILED", attempts: webhook.attempts + 1 }
        });
        log.warn("Webhook destination refused", { id: webhookId, reason: (error as Error).message });
        return { success: false, status: "FAILED", error: (error as Error).message };
    }

    try {
        log.info("Attempting webhook delivery", { id: webhookId, attempt: webhook.attempts + 1 });

        const res = await fetch(webhook.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Tabletop-Event-Id": webhook.eventId.toString(),
                "X-Webhook-Id": webhook.id,
                "X-Tabletop-Signature": signWebhookBody(webhook.payload),
            },
            body: webhook.payload,
            // Redirects are not followed: a 3xx could point the request back at a private host.
            redirect: "manual",
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
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
        const nextTime = new Date(now.getTime() + 5 * 60 * 1000); // Default 5 min retry

        if (age > TIMEOUT_MS) {
            newStatus = "FAILED";
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

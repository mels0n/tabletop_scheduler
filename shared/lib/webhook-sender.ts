import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ValidationError } from "@/shared/errors";

/*
 * Destination checks for outbound webhooks. Delivery itself lives in
 * `features/integrations/webhooks/server/deliver.ts`, the only code that sends one.
 */

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

/** A webhook host that does not resolve within this long is treated as unresolvable. */
export const DNS_LOOKUP_TIMEOUT_MS = 5_000;

/**
 * The webhook host could not be resolved: lookup timeout, SERVFAIL, EAI_AGAIN or NXDOMAIN.
 * Still a `ValidationError` (a 400 when an event is created with this URL), but delivery
 * treats it as transient and retries, unlike a refused protocol, credential or address.
 */
export class WebhookHostUnresolvedError extends ValidationError {
    constructor(message = "Webhook URL host does not resolve") {
        super(message);
    }
}

/** One address a webhook host resolved to, already checked to be public. */
export interface VettedAddress {
    address: string;
    family: 4 | 6;
}

/**
 * Validates `url` and resolves its host once: https only, no credentials, and every address
 * the host resolves to must be public. Returns the parsed URL and those vetted addresses so
 * the caller can connect to exactly them (closing the DNS-rebinding window between check and
 * connect). Throws `ValidationError`, or its subclass `WebhookHostUnresolvedError` when the
 * host does not resolve.
 */
export async function resolveSafeWebhookTarget(url: string): Promise<{ url: URL; addresses: VettedAddress[] }> {
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
    let resolved: { address: string; family: number }[];
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        // A hung resolver must not stall event creation or a delivery batch.
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("DNS lookup timed out")), DNS_LOOKUP_TIMEOUT_MS);
        });
        resolved = await Promise.race([lookup(host, { all: true, verbatim: true }), timeout]);
    } catch {
        throw new WebhookHostUnresolvedError();
    } finally {
        if (timer) clearTimeout(timer);
    }
    if (resolved.length === 0 || resolved.some((a) => isPrivateAddress(a.address))) {
        throw new ValidationError("Webhook URL must resolve to a public address");
    }
    return {
        url: parsed,
        addresses: resolved.map((a) => ({ address: a.address, family: isIP(a.address) === 6 ? 6 : 4 })),
    };
}

/**
 * Throws `ValidationError` unless `url` is https and every address its host resolves to is
 * public. Used when an event is created with a callback URL; delivery uses
 * `resolveSafeWebhookTarget` so it can pin the vetted addresses.
 */
export async function assertSafeWebhookUrl(url: string): Promise<void> {
    await resolveSafeWebhookTarget(url);
}

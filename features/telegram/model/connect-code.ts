import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getServerConfig } from "@/shared/config/server";
import { TOKEN_LENGTH, toBase62 } from "@/shared/lib/token";

/**
 * Telegram chat binding codes.
 *
 * A chat is bound to an event only by `/connect <slug> <code>`, where the code is derived
 * from the event's admin token hash and its current chat binding. Only someone who can open
 * the manage page (an admin) sees it, so knowing the slug (which every invited player has)
 * is not enough to redirect an event's notifications.
 *
 * The manager sends the command inside the group, where every member can read it. The current
 * `telegramChatId` and the event's `telegramConnectNonce` are both part of the HMAC input, and
 * every successful `/connect` (including a reconnect of the same chat) writes a fresh nonce, so
 * the code that was just posted dies immediately: replaying it anywhere fails, and returning to
 * an earlier binding never revives an earlier code. The manage page always derives the code from
 * the current binding and nonce, so it shows the one valid next code. Rotating the admin token
 * also invalidates old codes.
 *
 * Codes are the first 128 bits of the HMAC as 22 base62 chars (case-sensitive). Before that
 * they were its first 8 hex chars, so a short code someone copied earlier is still accepted
 * (case-insensitively) while the event's nonce dates from that era (no `v2_` prefix). Every
 * successful `/connect` writes a `v2_` nonce, after which that event accepts only the long code.
 */

const LEGACY_CODE = /^[0-9a-f]{8}$/i;
const CODE = new RegExp(`^[0-9A-Za-z]{${TOKEN_LENGTH}}$`);
const NONCE_PREFIX = "v2_";

/** Bot reply for any attempt to connect without a valid code. No em dashes: users read this. */
export const CONNECT_INSTRUCTIONS =
    "To connect this chat, open the event's manage page and send the connect command shown there. " +
    "It looks like <code>/connect your-event-code</code> followed by a long code.";

export const CONNECT_CODE_INVALID =
    "⚠️ That connect code is not valid for this event. Open the manage page and copy the connect command again.";

function connectHmac(slug: string, adminTokenHash: string, telegramChatId: string | null, nonce: string | null): Buffer {
    return createHmac("sha256", getServerConfig().sessionSecret)
        .update(`connect:${slug}:${adminTokenHash}:${telegramChatId ?? ""}:${nonce ?? ""}`, "utf8")
        .digest();
}

/**
 * First 16 bytes (128 bits) of HMAC-SHA256(sessionSecret,
 * `connect:${slug}:${adminTokenHash}:${telegramChatId ?? ""}:${telegramConnectNonce ?? ""}`),
 * as 22 base62 chars.
 */
export function connectCodeFor(
    slug: string,
    adminTokenHash: string,
    telegramChatId: string | null,
    nonce: string | null
): string {
    return toBase62(connectHmac(slug, adminTokenHash, telegramChatId, nonce).subarray(0, 16));
}

/** Timing-safe check of a user-supplied code. False for any malformed input; never throws. */
export function verifyConnectCode(
    slug: string,
    adminTokenHash: string | null | undefined,
    telegramChatId: string | null | undefined,
    nonce: string | null | undefined,
    code: string | null | undefined
): boolean {
    if (!adminTokenHash || !code) return false;
    const given = code.trim();
    if (CODE.test(given)) {
        return sameString(given, connectCodeFor(slug, adminTokenHash, telegramChatId || null, nonce || null));
    }
    if (LEGACY_CODE.test(given) && !nonce?.startsWith(NONCE_PREFIX)) {
        // A pre-128-bit short code stays valid until the event's first `v2_` nonce.
        const legacy = connectHmac(slug, adminTokenHash, telegramChatId || null, nonce || null).toString("hex").slice(0, 8);
        return sameString(given.toLowerCase(), legacy);
    }
    return false;
}

/** Timing-safe compare of two strings already known to have the same length. */
function sameString(a: string, b: string): boolean {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/** Parses `/connect[@bot] <slug> <code>`; missing parts come back as null. */
export function parseConnectCommand(text: string): { slug: string | null; code: string | null } {
    const parts = text.trim().split(/\s+/);
    return { slug: parts[1] || null, code: parts[2] || null };
}

/** A fresh random nonce for `telegramConnectNonce`; the `v2_` prefix retires short codes. */
export function newConnectNonce(): string {
    return NONCE_PREFIX + randomBytes(16).toString("hex");
}

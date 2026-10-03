import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerConfig } from "@/shared/config/server";

/**
 * Telegram chat binding codes.
 *
 * A chat is bound to an event only by `/connect <slug> <code>`, where the code is derived
 * from the event's admin token hash. Only someone who can open the manage page (an admin)
 * sees it, so knowing the slug (which every invited player has) is no longer enough to
 * redirect an event's notifications. Rotating the admin token invalidates old codes.
 */

const CODE_LENGTH = 8;

/** Bot reply for any attempt to connect without a valid code. No em dashes: users read this. */
export const CONNECT_INSTRUCTIONS =
    "To connect this chat, open the event's manage page and send the connect command shown there. " +
    "It looks like <code>/connect your-event-code 1a2b3c4d</code>.";

export const CONNECT_CODE_INVALID =
    "⚠️ That connect code is not valid for this event. Open the manage page and copy the connect command again.";

/** First 8 hex chars of HMAC-SHA256(sessionSecret, `connect:${slug}:${adminTokenHash}`). */
export function connectCodeFor(slug: string, adminTokenHash: string): string {
    return createHmac("sha256", getServerConfig().sessionSecret)
        .update(`connect:${slug}:${adminTokenHash}`, "utf8")
        .digest("hex")
        .slice(0, CODE_LENGTH);
}

/** Timing-safe check of a user-supplied code. False for any malformed input; never throws. */
export function verifyConnectCode(
    slug: string,
    adminTokenHash: string | null | undefined,
    code: string | null | undefined
): boolean {
    if (!adminTokenHash || !code) return false;
    const given = code.trim().toLowerCase();
    if (!/^[0-9a-f]+$/.test(given) || given.length !== CODE_LENGTH) return false;
    const expected = connectCodeFor(slug, adminTokenHash);
    return timingSafeEqual(Buffer.from(given, "utf8"), Buffer.from(expected, "utf8"));
}

/** Parses `/connect[@bot] <slug> <code>`; missing parts come back as null. */
export function parseConnectCommand(text: string): { slug: string | null; code: string | null } {
    const parts = text.trim().split(/\s+/);
    return { slug: parts[1] || null, code: parts[2] || null };
}

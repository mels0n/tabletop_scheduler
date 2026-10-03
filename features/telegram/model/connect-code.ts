import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getServerConfig } from "@/shared/config/server";

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
 */

const CODE_LENGTH = 8;

/** Bot reply for any attempt to connect without a valid code. No em dashes: users read this. */
export const CONNECT_INSTRUCTIONS =
    "To connect this chat, open the event's manage page and send the connect command shown there. " +
    "It looks like <code>/connect your-event-code 1a2b3c4d</code>.";

export const CONNECT_CODE_INVALID =
    "⚠️ That connect code is not valid for this event. Open the manage page and copy the connect command again.";

/**
 * First 8 hex chars of HMAC-SHA256(sessionSecret,
 * `connect:${slug}:${adminTokenHash}:${telegramChatId ?? ""}:${telegramConnectNonce ?? ""}`).
 */
export function connectCodeFor(
    slug: string,
    adminTokenHash: string,
    telegramChatId: string | null,
    nonce: string | null
): string {
    return createHmac("sha256", getServerConfig().sessionSecret)
        .update(`connect:${slug}:${adminTokenHash}:${telegramChatId ?? ""}:${nonce ?? ""}`, "utf8")
        .digest("hex")
        .slice(0, CODE_LENGTH);
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
    const given = code.trim().toLowerCase();
    if (!/^[0-9a-f]+$/.test(given) || given.length !== CODE_LENGTH) return false;
    const expected = connectCodeFor(slug, adminTokenHash, telegramChatId || null, nonce || null);
    return timingSafeEqual(Buffer.from(given, "utf8"), Buffer.from(expected, "utf8"));
}

/** Parses `/connect[@bot] <slug> <code>`; missing parts come back as null. */
export function parseConnectCommand(text: string): { slug: string | null; code: string | null } {
    const parts = text.trim().split(/\s+/);
    return { slug: parts[1] || null, code: parts[2] || null };
}

/** A fresh random nonce for `telegramConnectNonce`. */
export function newConnectNonce(): string {
    return randomBytes(16).toString("hex");
}

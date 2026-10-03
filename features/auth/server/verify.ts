import "server-only";

import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import prisma from "@/shared/lib/prisma";
import { hashToken } from "@/shared/lib/token";
import { readIdentity } from "@/shared/lib/session";
import { ForbiddenError } from "@/shared/errors";
import Logger from "@/shared/lib/logger";

const log = Logger.get("AdminAuth");

const HASH_FORMAT = /^[0-9a-f]{64}$/;

/** A stored admin token that is not a SHA-256 hex digest is a pre-hashing plaintext row. */
function isLegacyPlaintext(stored: string): boolean {
    return !HASH_FORMAT.test(stored);
}

function safeEqual(a: string, b: string): boolean {
    const x = Buffer.from(a, "utf8");
    const y = Buffer.from(b, "utf8");
    return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * True when `token` is the raw admin token for the stored value. A stored SHA-256 hash matches
 * only the raw token that hashes to it; the hash itself is never accepted as a token. A stored
 * value that is not a hash is a legacy plaintext row from before hashing and matches the token
 * as written, so a deploy never invalidates an existing admin link. Callers upgrade such a row
 * with `upgradeLegacyAdminToken` after a successful match.
 */
export function isAdminToken(token: string, stored: string | null | undefined): boolean {
    if (!token || !stored) return false;
    return isLegacyPlaintext(stored) ? safeEqual(token, stored) : safeEqual(hashToken(token), stored);
}

/**
 * Rewrites a legacy plaintext `adminToken` row as its hash. Call only after `isAdminToken`
 * matched. Best effort: a failure is logged and never blocks the request, and the row is
 * simply upgraded on the next successful use.
 */
export async function upgradeLegacyAdminToken(slug: string, token: string, stored: string | null | undefined): Promise<void> {
    if (!stored || !isLegacyPlaintext(stored)) return;
    try {
        await prisma.event.update({ where: { slug }, data: { adminToken: hashToken(token) } });
    } catch (e) {
        log.warn("Could not upgrade legacy admin token", { slug, error: (e as Error).message });
    }
}

/**
 * Whether the current request may manage the event `slug`. Admin if either:
 * - the `tabletop_admin_<slug>` cookie holds the raw token whose hash is `adminToken` (or, for a
 *   legacy plaintext row, the token itself, which is then upgraded to its hash), or
 * - a signed identity cookie (see `shared/lib/session.ts`) matches the event's manager.
 * Unsigned identity cookies are ignored.
 */
export async function verifyEventAdmin(slug: string): Promise<boolean> {
    const cookieStore = await cookies();
    const token = cookieStore.get(`tabletop_admin_${slug}`)?.value;
    const { chatId, discordId } = readIdentity(cookieStore);

    if (!token && !chatId && !discordId) return false;

    const event = await prisma.event.findUnique({
        where: { slug },
        select: { adminToken: true, managerChatId: true, managerDiscordId: true },
    });
    if (!event) return false;

    if (token && isAdminToken(token, event.adminToken)) {
        await upgradeLegacyAdminToken(slug, token, event.adminToken);
        return true;
    }
    if (chatId && event.managerChatId === chatId) return true;
    if (discordId && event.managerDiscordId === discordId) return true;
    return false;
}

/** Throws `ForbiddenError` unless the current request is an admin of `slug`. */
export async function requireEventAdmin(slug: string): Promise<void> {
    if (!(await verifyEventAdmin(slug))) {
        throw new ForbiddenError();
    }
}

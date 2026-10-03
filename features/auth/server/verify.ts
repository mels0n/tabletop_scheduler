import "server-only";

import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import prisma from "@/shared/lib/prisma";
import { hashToken } from "@/shared/lib/token";
import { readIdentity } from "@/shared/lib/session";
import { ForbiddenError } from "@/shared/errors";

/**
 * True when `token` is the raw admin token whose SHA-256 hash is `storedHash`.
 * Only the hash is ever stored, so the stored value itself is never accepted as a token.
 */
export function isAdminToken(token: string, storedHash: string | null | undefined): boolean {
    if (!token || !storedHash) return false;
    const given = Buffer.from(hashToken(token), "utf8");
    const expected = Buffer.from(storedHash, "utf8");
    return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Whether the current request may manage the event `slug`. Admin if either:
 * - the `tabletop_admin_<slug>` cookie holds the raw token whose hash is `adminToken`, or
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

    if (token && isAdminToken(token, event.adminToken)) return true;
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

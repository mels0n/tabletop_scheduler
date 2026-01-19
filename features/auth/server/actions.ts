"use server";

import { cookies } from "next/headers";
import { COOKIE_MAX_AGE, COOKIE_BASE_OPTIONS } from "@/shared/lib/auth-cookie";
import { hashToken } from "@/shared/lib/token";
import prisma from "@/shared/lib/prisma";

/**
 * Sets a secure, HTTP-only cookie for admin authentication.
 *
 * @param {string} slug - The event slug identifier.
 * @param {string} token - The administrative token.
 */
export async function setAdminCookie(slug: string, token: string) {
    const cookieStore = cookies();
    const opts = {
        ...COOKIE_BASE_OPTIONS,
        maxAge: COOKIE_MAX_AGE
    };
    cookieStore.set(`tabletop_admin_${slug}`, token, opts);
}

/**
 * Verifies if the current user is an admin for the given event.
 * Uses the HTTP-Only cookie and Hashing logic.
 */
export async function verifyEventAdmin(slug: string): Promise<boolean> {
    const cookieStore = cookies();
    const token = cookieStore.get(`tabletop_admin_${slug}`)?.value;

    if (!token) return false;

    // Security: Hash the cookie value before comparing to DB
    const tokenHash = hashToken(token);

    const event = await prisma.event.findUnique({
        where: { slug },
        select: { adminToken: true }
    });

    if (!event) return false;

    // Check Hash OR Legacy Plaintext (Migration support)
    if (token && event && (event.adminToken === tokenHash || event.adminToken === token)) {
        return true;
    }

    // 2. Global Identity Fallback (Recovery/Magic Link)
    // If the user has logged in via a Magic Link (setting a global user cookie),
    // we verify if that global user is the declared manager of this event.
    const globalChatId = cookieStore.get("tabletop_user_chat_id")?.value;
    const globalDiscordId = cookieStore.get("tabletop_user_discord_id")?.value;

    if (globalChatId || globalDiscordId) {
        // Optimization: Refetch if we didn't fetch manager fields above, or just rely on a wider select initially.
        // For safety/cleanliness, let's just query what we need if we fall back.
        const eventManager = await prisma.event.findUnique({
            where: { slug },
            select: { managerChatId: true, managerDiscordId: true }
        });

        if (eventManager) {
            if (globalChatId && eventManager.managerChatId === globalChatId) return true;
            if (globalDiscordId && eventManager.managerDiscordId === globalDiscordId) return true;
        }
    }

    return false;
}

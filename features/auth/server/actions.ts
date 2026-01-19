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
    return event.adminToken === tokenHash || event.adminToken === token;
}

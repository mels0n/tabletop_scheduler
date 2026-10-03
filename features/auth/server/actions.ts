"use server";

import { cookies } from "next/headers";
import { COOKIE_MAX_AGE, COOKIE_BASE_OPTIONS } from "@/shared/lib/auth-cookie";
import { verifyEventAdmin as verifyEventAdminImpl } from "./verify";

/**
 * Sets a secure, HTTP-only cookie for admin authentication.
 *
 * @param {string} slug - The event slug identifier.
 * @param {string} token - The raw administrative token (only its hash is stored).
 */
export async function setAdminCookie(slug: string, token: string) {
    const cookieStore = await cookies();
    const opts = {
        ...COOKIE_BASE_OPTIONS,
        maxAge: COOKIE_MAX_AGE
    };
    cookieStore.set(`tabletop_admin_${slug}`, token, opts);
}

// TODO: repoint the remaining importers to `./verify` and delete this wrapper; exported here it is also registered as a server action.
export async function verifyEventAdmin(slug: string): Promise<boolean> {
    return verifyEventAdminImpl(slug);
}

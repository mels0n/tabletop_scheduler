"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { COOKIE_MAX_AGE, COOKIE_BASE_OPTIONS } from "@/shared/lib/auth-cookie";

/**
 * Client-callable server actions of the auth slice. Everything exported here is a public
 * endpoint: admin verification (`verifyEventAdmin`, `requireEventAdmin`) lives in the
 * `server-only` module `./verify` and must never be exported from this file.
 */

const adminCookieInput = z.object({
    slug: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    token: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
});

/**
 * Sets a secure, HTTP-only cookie for admin authentication. Called by the create page
 * right after the event is created. Grants nothing by itself: the token is checked
 * against the stored hash on every use.
 *
 * @param {string} slug - The event slug identifier.
 * @param {string} token - The raw administrative token (only its hash is stored).
 */
export async function setAdminCookie(slug: string, token: string) {
    const input = adminCookieInput.parse({ slug, token });
    const cookieStore = await cookies();
    const opts = {
        ...COOKIE_BASE_OPTIONS,
        maxAge: COOKIE_MAX_AGE
    };
    cookieStore.set(`tabletop_admin_${input.slug}`, input.token, opts);
}

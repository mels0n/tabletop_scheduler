import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { IDENTITY_COOKIES, identityCookieOptions, verifyValue } from '@/shared/lib/session'

/** Matches /e/<slug>/manage and anything below it; capture group 1 is the slug. */
const MANAGE_ROUTE = /^\/e\/([^/]+)\/manage(\/|$)/;

const ADMIN_COOKIE_PREFIX = 'tabletop_admin_';

/** Each signed identity cookie and the display-name cookie that only means something alongside it. */
const IDENTITY_PAIRS = [
    { id: IDENTITY_COOKIES.telegram, name: 'tabletop_user_telegram_name' },
    { id: IDENTITY_COOKIES.discord, name: 'tabletop_user_discord_name' },
] as const;

/**
 * @function proxy
 * @description Request proxy that enforces administrative access AND implements Sliding Sessions.
 *
 * Sliding Session Logic:
 * On every matched request, auth cookies are re-set with the same value and a fresh
 * 400-day expiry so active users never get logged out. Identity cookies are refreshed
 * only when their signature verifies; an unsigned or tampered identity cookie (for
 * example a pre-signing legacy value) is deleted together with its display-name cookie.
 */
export function proxy(request: NextRequest) {
    const response = NextResponse.next();
    const identityOpts = identityCookieOptions();
    let hasVerifiedIdentity = false;

    // 1. Sliding Session Implementation
    for (const pair of IDENTITY_PAIRS) {
        const idCookie = request.cookies.get(pair.id);
        if (!idCookie) continue;

        if (verifyValue(idCookie.value) === null) {
            response.cookies.delete(pair.id);
            if (request.cookies.has(pair.name)) response.cookies.delete(pair.name);
            continue;
        }

        hasVerifiedIdentity = true;
        response.cookies.set({ name: pair.id, value: idCookie.value, ...identityOpts });

        const nameCookie = request.cookies.get(pair.name);
        if (nameCookie) {
            // Display names are read by client JS, so they are the only non-HttpOnly cookies.
            response.cookies.set({ name: pair.name, value: nameCookie.value, ...identityOpts, httpOnly: false });
        }
    }

    // Event admin cookies hold a raw token that is checked against its hash on every use.
    for (const cookie of request.cookies.getAll()) {
        if (cookie.name.startsWith(ADMIN_COOKIE_PREFIX)) {
            response.cookies.set({ name: cookie.name, value: cookie.value, ...identityOpts });
        }
    }

    // 2. Route Protection Logic
    // URL structure is /e/[slug]/manage or /e/[slug]/manage/...
    const manageMatch = MANAGE_ROUTE.exec(request.nextUrl.pathname);
    if (manageMatch) {
        const slug = manageMatch[1];

        if (slug) {
            const adminToken = request.cookies.get(`${ADMIN_COOKIE_PREFIX}${slug}`)?.value;

            if (!adminToken && !hasVerifiedIdentity) {
                // Intent: Redirect unauthorized users back to the public event page.
                // A verified identity is let through to the page, where `verifyEventAdmin`
                // checks the database to see if they own THIS specific event.
                return NextResponse.redirect(new URL(`/e/${slug}?action=login`, request.url));
            }
        }
    }

    return response;
}

export const config = {
    // Intent: Run on all event pages to catch both Users (Votes) and Managers
    // Also run on Profile to keep that synced.
    matcher: [
        '/e/:slug*', // Covers /e/[slug], /e/[slug]/manage, /e/[slug]/vote etc
        '/profile'
    ],
}

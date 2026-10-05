import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { IDENTITY_COOKIES, IDENTITY_PURPOSES, identityCookieOptions, verifyValue } from '@/shared/lib/session'
import { REQUEST_ID_HEADER, resolveRequestId } from '@/shared/lib/logger'

/** Matches /e/<slug>/manage and anything below it; capture group 1 is the slug. */
const MANAGE_ROUTE = /^\/e\/([^/]+)\/manage(\/|$)/;

const ADMIN_COOKIE_PREFIX = 'tabletop_admin_';

/** Each signed identity cookie and the display-name cookie that only means something alongside it. */
const IDENTITY_PAIRS = [
    { id: IDENTITY_COOKIES.telegram, purpose: IDENTITY_PURPOSES.telegram, name: 'tabletop_user_telegram_name' },
    { id: IDENTITY_COOKIES.discord, purpose: IDENTITY_PURPOSES.discord, name: 'tabletop_user_discord_name' },
] as const;

/**
 * @function proxy
 * @description Request proxy that tags every request with a correlation id, enforces
 * administrative access, and implements Sliding Sessions.
 *
 * Request ids: the incoming `x-request-id` is reused when well formed, otherwise a UUID is
 * minted. It is forwarded on the request (route handlers read it via `Logger.fromRequest`)
 * and echoed on the response. Only page requests reach this proxy; API route handlers are
 * not matched and mint their own id via `Logger.fromRequest`.
 *
 * Sliding Session Logic:
 * On every matched request, auth cookies are re-set with the same value and a fresh
 * 400-day expiry so active users never get logged out. Identity cookies are refreshed
 * only when their signature verifies; an unsigned or tampered identity cookie (for
 * example a pre-signing legacy value) is deleted together with its display-name cookie.
 */
export function proxy(request: NextRequest) {
    const requestId = resolveRequestId(request.headers);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(REQUEST_ID_HEADER, requestId);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set(REQUEST_ID_HEADER, requestId);

    const redirect = refreshSessionsAndGuard(request, response);
    if (redirect) {
        redirect.headers.set(REQUEST_ID_HEADER, requestId);
        return redirect;
    }
    return response;
}

/**
 * Applies the sliding refresh to `response` and returns a redirect when a manage page is
 * requested with neither the event's admin cookie nor a verified identity, else null.
 */
function refreshSessionsAndGuard(request: NextRequest, response: NextResponse): NextResponse | null {
    const identityOpts = identityCookieOptions();
    let hasVerifiedIdentity = false;

    // 1. Sliding Session Implementation
    for (const pair of IDENTITY_PAIRS) {
        const idCookie = request.cookies.get(pair.id);
        if (!idCookie) continue;

        if (verifyValue(pair.purpose, idCookie.value) === null) {
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

    return null;
}

export const config = {
    // Intent: Run on all event pages to catch both Users (Votes) and Managers
    // Also run on Profile to keep that synced. API routes are deliberately excluded.
    matcher: [
        '/e/:slug*', // Covers /e/[slug], /e/[slug]/manage, /e/[slug]/vote etc
        '/profile',
    ],
}

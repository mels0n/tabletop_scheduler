import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// The sliding logic is kept self-contained here so the proxy has no app imports.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // 400 days

/** Matches /e/<slug>/manage and anything below it; capture group 1 is the slug. */
const MANAGE_ROUTE = /^\/e\/([^/]+)\/manage(\/|$)/;

/** Cookies readable by client JS (not HttpOnly). Every other refreshed cookie stays HttpOnly. */
const PUBLIC_COOKIES = new Set(['tabletop_user_discord_name', 'tabletop_user_telegram_name']);

/**
 * @function proxy
 * @description Request proxy that enforces administrative access AND implements Sliding Sessions.
 *
 * Sliding Session Logic:
 * On every request to the app, we check if the user has any "Auth" cookies.
 * If they do, we re-set them with the same value but a fresh 400-day expiration.
 * This ensures active users never get logged out.
 */
export function proxy(request: NextRequest) {
    const response = NextResponse.next();

    // 1. Sliding Session Implementation
    // Intent: Refresh cookies on every interaction to keep session alive indefinitely (up to 400 days from TODAY)
    const cookiesToRefresh = [
        'tabletop_user_chat_id',
        'tabletop_user_discord_id',
        'tabletop_user_discord_name',
        'tabletop_user_telegram_name'
    ];

    // Check for Dynamic Admin Cookies (tabletop_admin_*)
    request.cookies.getAll().forEach(cookie => {
        if (cookie.name.startsWith('tabletop_admin_')) {
            cookiesToRefresh.push(cookie.name);
        }
    });

    cookiesToRefresh.forEach(cookieName => {
        const cookie = request.cookies.get(cookieName);
        if (cookie) {
            // Intent: Re-set the cookie with the exact same value/options, just new Max-Age
            // Note: We must replicate the specific flags (HttpOnly etc) or they default to strict.
            // The display-name cookies are the only ones that are NOT HttpOnly.
            const isPublic = PUBLIC_COOKIES.has(cookieName);

            response.cookies.set({
                name: cookieName,
                value: cookie.value,
                maxAge: COOKIE_MAX_AGE,
                path: '/',
                secure: process.env.NODE_ENV === "production",
                httpOnly: !isPublic,
                sameSite: 'lax'
            });
        }
    });

    // 2. Route Protection Logic
    // URL structure is /e/[slug]/manage or /e/[slug]/manage/...
    const manageMatch = MANAGE_ROUTE.exec(request.nextUrl.pathname);
    if (manageMatch) {
        const slug = manageMatch[1];

        if (slug) {
            const adminToken = request.cookies.get(`tabletop_admin_${slug}`)?.value;
            const globalChatId = request.cookies.get('tabletop_user_chat_id')?.value;
            const globalDiscordId = request.cookies.get('tabletop_user_discord_id')?.value;

            if (!adminToken && !globalChatId && !globalDiscordId) {
                // Intent: Redirect unauthorized users back to the public event page.
                // If they have a global auth cookie, we let them through to the page where
                // `verifyEventAdmin` will securely check the database to see if they own THIS specific event.
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

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Intent: Edge Middleware limitation - cannot import from shared/lib directly in some setups?
// Actually, shared/lib imports should work if they are pure JS/TS.
// However, to be safe and atomic, we define the sliding logic here.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // 400 days

/**
 * @function middleware
 * @description Edge middleware to enforce administrative access AND implement Sliding Sessions.
 *
 * Sliding Session Logic:
 * On every request to the app, we check if the user has any "Auth" cookies.
 * If they do, we re-set them with the same value but a fresh 400-day expiration.
 * This ensures active users never get logged out.
 */
export function middleware(request: NextRequest) {
    const response = NextResponse.next();

    // 1. Sliding Session Implementation
    // Intent: Refresh cookies on every interaction to keep session alive indefinitely (up to 400 days from TODAY)
    const cookiesToRefresh = [
        'tabletop_user_chat_id',
        'tabletop_user_discord_id',
        'tabletop_user_discord_name'
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
            // "discord_name" is the only one that is NOT HttpOnly.
            const isPublic = cookieName === 'tabletop_user_discord_name';

            response.cookies.set({
                name: cookieName,
                value: cookie.value,
                maxAge: COOKIE_MAX_AGE,
                path: '/',
                secure: process.env.NODE_ENV === "production",
                httpOnly: !isPublic,
                sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax'
            });
        }
    });

    // 2. Route Protection Logic
    if (request.nextUrl.pathname.includes('/manage')) {
        // e.g. /e/some-slug/manage
        const parts = request.nextUrl.pathname.split('/');
        // URL structure could be /e/[slug]/manage OR /e/[slug]/manage/...
        // split on / -> ["", "e", "slug", "manage"]
        const slugIndex = parts.indexOf('e') + 1;
        const slug = parts[slugIndex];

        if (slug) {
            const adminToken = request.cookies.get(`tabletop_admin_${slug}`)?.value;

            if (!adminToken) {
                // Intent: Redirect unauthorized users back to the public event page.
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

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * @function middleware
 * @description Edge middleware to enforce administrative access for event management routes.
 * Checks for the presence of an event-specific admin cookie before allowing access to `/manage` pages.
 *
 * @param {NextRequest} request - The incoming HTTP request.
 * @returns {NextResponse} The response action (modify, redirect, or next).
 */
export function middleware(request: NextRequest) {
    // Intent: Intercept requests to management routes to enforce authorization.
    if (request.nextUrl.pathname.endsWith('/manage')) {
        // e.g. /e/some-slug/manage
        const parts = request.nextUrl.pathname.split('/');
        const slug = parts[2]; // /e/[slug]/manage -> slug is index 2

        const adminToken = request.cookies.get(`tabletop_admin_${slug}`)?.value;

        if (!adminToken) {
            // Intent: Redirect unauthorized users back to the public event page.
            // Note: Presence check is a lightweight authorized heuristic; deeper validation occurs downstream.
            return NextResponse.redirect(new URL(`/e/${slug}`, request.url));
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: '/e/:slug*/manage',
}

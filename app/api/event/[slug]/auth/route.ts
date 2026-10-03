import { NextRequest, NextResponse } from "next/server";
import { isAdminToken, setAdminCookie } from "@/features/auth";
import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";

const log = Logger.get("AuthRoute");

/**
 * @function GET
 * @description Handles the "Magic Link" login flow for Event Managers.
 *
 * Flow:
 * 1. User clicks Telegram/Discord link (`/api/event/[slug]/auth?token=...`).
 * 2. System checks that the SHA-256 hash of `token` equals the event's stored `adminToken` hash.
 * 3. On Success: sets the event-specific admin cookie (`tabletop_admin_[slug]`) and
 *    redirects to `/manage`. It never sets a global identity cookie: the event's stored
 *    manager IDs say nothing about who holds this token.
 * 4. On Failure: Redirects to the public event page with an error query param.
 *
 * Redirects are built from the request's own origin, so a self-host without
 * NEXT_PUBLIC_BASE_URL works and the target host is never taken from configuration.
 *
 * @param {NextRequest} request - The incoming request containing the token query param.
 * @param {Object} context - Route parameters.
 * @param {string} context.params.slug - The event identifier.
 * @returns {NextResponse} Redirect response.
 */
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
    const params = await props.params;
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");
    const slug = params.slug;
    const eventPath = `/e/${encodeURIComponent(slug)}`;
    const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));

    if (!token) {
        return redirectTo(eventPath);
    }

    try {
        const event = await prisma.event.findUnique({
            where: { slug }
        });

        // Security: only the raw token is accepted; the stored hash itself is never a valid token.
        if (!event || !isAdminToken(token, event.adminToken)) {
            log.warn("Invalid Magic Link attempt", { slug });
            return redirectTo(`${eventPath}?error=invalid_token`);
        }

        // 1. Set the event-specific admin cookie for /manage access.
        await setAdminCookie(slug, token);

        // No global identity cookie is minted here. The manager fields on the event are
        // not proof of who holds this token, so identity comes only from /auth/login
        // (a LoginToken DMed to the platform account) or Discord OAuth.

        log.info("Magic Link login successful", { scope: "event", identifier: slug });
        return redirectTo(`${eventPath}/manage`);

    } catch (e) {
        log.error("Magic Link error", e as Error);
        return redirectTo(`${eventPath}?error=server_error`);
    }
}

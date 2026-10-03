import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAdminToken, setAdminCookie } from "@/features/auth";
import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { COOKIE_MAX_AGE, COOKIE_BASE_OPTIONS } from "@/shared/lib/auth-cookie";
import { identityCookieOptions, IDENTITY_COOKIES, signIdentity } from "@/shared/lib/session";

const log = Logger.get("AuthRoute");

/**
 * @function GET
 * @description Handles the "Magic Link" login flow for Event Managers.
 *
 * Flow:
 * 1. User clicks Telegram/Discord link (`/api/event/[slug]/auth?token=...`).
 * 2. System checks that the SHA-256 hash of `token` equals the event's stored `adminToken` hash.
 * 3. On Success:
 *    a. Sets the event-specific admin cookie (`tabletop_admin_[slug]`).
 *    b. Hydrates the signed Global Identity cookies (Discord/Telegram) from the event's
 *       manager fields so the user is recognized across ALL pages (Voting, Profile, etc.),
 *       not just the Manage page. This closes the "logged out on voting page" gap.
 *    c. Redirects to `/manage`.
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

        // 2. Hydrate Global Identity cookies from the event's manager fields.
        // WHY: Without this, the user appears anonymous on the public Voting page
        // because VotingInterface reads global cookies, not event-specific admin tokens.
        // Identity cookies are HMAC-signed so they cannot be forged from a known platform ID.
        const cookieStore = await cookies();
        const cookieOpts = { ...COOKIE_BASE_OPTIONS, maxAge: COOKIE_MAX_AGE };

        if (event.managerDiscordId) {
            cookieStore.set(IDENTITY_COOKIES.discord, signIdentity("discord", event.managerDiscordId), identityCookieOptions());
            if (event.managerDiscordUsername) {
                cookieStore.set("tabletop_user_discord_name", event.managerDiscordUsername, { ...cookieOpts, httpOnly: false });
            }
        }

        if (event.managerChatId) {
            cookieStore.set(IDENTITY_COOKIES.telegram, signIdentity("telegram", event.managerChatId), identityCookieOptions());
        }

        log.info("Magic Link login successful (global identity synced)", { scope: "event", identifier: slug });
        return redirectTo(`${eventPath}/manage`);

    } catch (e) {
        log.error("Magic Link error", e as Error);
        return redirectTo(`${eventPath}?error=server_error`);
    }
}

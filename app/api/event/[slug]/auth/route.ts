import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setAdminCookie } from "@/features/auth/server/actions";
import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { getBaseUrl } from "@/shared/lib/url";
import { COOKIE_MAX_AGE, COOKIE_BASE_OPTIONS } from "@/shared/lib/auth-cookie";

const log = Logger.get("AuthRoute");

/**
 * @function GET
 * @description Handles the "Magic Link" login flow for Event Managers.
 *
 * Flow:
 * 1. User clicks Telegram/Discord link (`/api/event/[slug]/auth?token=...`).
 * 2. System validates the `token` against the `adminToken` stored in the DB for that event.
 * 3. On Success:
 *    a. Sets the event-specific admin cookie (`tabletop_admin_[slug]`).
 *    b. Hydrates the Global Identity cookies (Discord/Telegram) from the event's
 *       manager fields so the user is recognized across ALL pages (Voting, Profile, etc.),
 *       not just the Manage page. This closes the "logged out on voting page" gap.
 *    c. Redirects to `/manage`.
 * 4. On Failure: Redirects to the public event page with an error query param.
 *
 * @param {NextRequest} request - The incoming request containing the token query param.
 * @param {Object} context - Route parameters.
 * @param {string} context.params.slug - The event identifier.
 * @returns {NextResponse} Redirect response.
 */
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");
    const slug = params.slug;
    const baseUrl = getBaseUrl(request.headers);

    if (!token) {
        return NextResponse.redirect(`${baseUrl}/e/${slug}`);
    }

    try {
        const event = await prisma.event.findUnique({
            where: { slug }
        });

        // Security: Strict token equality check with Hashing.
        // We accept that the DB might still have plaintext tokens during migration.
        // Logic: Hash(Input) === DB OR Input === DB (Legacy Fallback)
        const { hashToken } = await import("@/shared/lib/token");
        const inputHash = hashToken(token);

        const isValid = event && (event.adminToken === inputHash || event.adminToken === token);

        if (!isValid) {
            log.warn("Invalid Magic Link attempt", { slug });
            return NextResponse.redirect(`${baseUrl}/e/${slug}?error=invalid_token`);
        }

        // 1. Set the event-specific admin cookie for /manage access.
        await setAdminCookie(slug, token);

        // 2. Hydrate Global Identity cookies from the event's manager fields.
        // WHY: Without this, the user appears anonymous on the public Voting page
        // because VotingInterface reads global cookies, not event-specific admin tokens.
        // Uses the same cookie options as the Discord OAuth callback for consistency.
        const cookieStore = cookies();
        const cookieOpts = { ...COOKIE_BASE_OPTIONS, maxAge: COOKIE_MAX_AGE };

        if (event.managerDiscordId) {
            cookieStore.set("tabletop_user_discord_id", event.managerDiscordId, cookieOpts);
            if (event.managerDiscordUsername) {
                cookieStore.set("tabletop_user_discord_name", event.managerDiscordUsername, { ...cookieOpts, httpOnly: false });
            }
        }

        if (event.managerChatId) {
            cookieStore.set("tabletop_user_chat_id", event.managerChatId, cookieOpts);
        }

        log.info("Magic Link login successful (global identity synced)", { scope: "event", identifier: slug });
        return NextResponse.redirect(`${baseUrl}/e/${slug}/manage`);

    } catch (e) {
        log.error("Magic Link error", e as Error);
        return NextResponse.redirect(`${baseUrl}/e/${slug}?error=server_error`);
    }
}

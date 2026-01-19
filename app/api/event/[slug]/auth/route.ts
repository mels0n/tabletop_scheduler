import { NextRequest, NextResponse } from "next/server";
import { setAdminCookie } from "@/features/auth/server/actions";
import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { getBaseUrl } from "@/shared/lib/url";

const log = Logger.get("AuthRoute");

/**
 * @function GET
 * @description Handles the "Magic Link" login flow for Event Managers.
 *
 * Flow:
 * 1. User clicks email/Telegram link (`/api/event/[slug]/auth?token=...`).
 * 2. System validates the `token` against the `adminToken` stored in the DB for that event.
 * 3. On Success: Sets a secure, HTTP-only cookie (`tabletop_admin_[slug]`) and redirects to `/manage`.
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

        // Set the cookie via the helper (which uses Next.js server actions / cookies())
        // Intent: Authenticate the user session for subsequent requests.
        await setAdminCookie(slug, token);

        log.info("Magic Link login successful", { slug });
        return NextResponse.redirect(`${baseUrl}/e/${slug}/manage`);

    } catch (e) {
        log.error("Magic Link error", e as Error);
        return NextResponse.redirect(`${baseUrl}/e/${slug}?error=server_error`);
    }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { cookies } from "next/headers";
import { COOKIE_MAX_AGE, COOKIE_BASE_OPTIONS } from "@/shared/lib/auth-cookie";
import { identityCookieOptions, IDENTITY_COOKIES, signValue } from "@/shared/lib/session";

const log = Logger.get("Auth:Global");

export const dynamic = 'force-dynamic'; // Intent: Ensure no caching prevents token redemption.

/**
 * @function GET
 * @description Handles "Global Magic Link" login.
 *
 * Flow:
 * 1. User clicks link from Telegram (`/auth/login?token=abc`).
 * 2. System validates the ephemeral token (expires in 15 min).
 * 3. On Success: Sets the signed global identity cookie (`tabletop_user_chat_id` or
 *    `tabletop_user_discord_id`, 400 days) plus its display-name cookie.
 * 4. Redirects to the User Profile page.
 *
 * Security Note:
 * Tokens are NOT deleted immediately upon use to prevent "Link Preview" race conditions
 * where a crawler consumes the token before the user's browser loads.
 *
 * Redirects are built from the request's own origin, so a self-host without
 * NEXT_PUBLIC_BASE_URL keeps working.
 *
 * @param {NextRequest} request - Incoming request with `token` query param.
 * @returns {NextResponse} Redirect to profile or error page.
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");
    const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));

    if (!token) {
        return redirectTo("/profile?error=missing_token");
    }

    try {
        const { hashToken } = await import("@/shared/lib/token");
        const tokenHash = hashToken(token);

        // 1. Find Token (by Hash)
        const validToken = await prisma.loginToken.findUnique({
            where: { token: tokenHash }
        });

        // 2. Validate
        if (!validToken) {
            log.warn("Invalid Magic Link attempt");
            return redirectTo("/profile?error=invalid_token");
        }

        if (new Date() > validToken.expiresAt) {
            log.warn("Expired Global Magic Link attempt");
            return redirectTo("/profile?error=expired_token");
        }

        // 3. Set Cookie (HTTP Only, Secure, HMAC-signed so it cannot be forged from a known ID)
        // Intent: Authenticate the user globally across the app based on their Telegram Chat ID OR Discord ID.
        if (validToken.chatId) {
            (await cookies()).set(IDENTITY_COOKIES.telegram, signValue(validToken.chatId), identityCookieOptions());
            // Also set username for display (mirrors Discord below), so the vote
            // form can show a Telegram identity badge instead of an empty field.
            if (validToken.telegramUsername) {
                (await cookies()).set("tabletop_user_telegram_name", validToken.telegramUsername, {
                    ...COOKIE_BASE_OPTIONS,
                    httpOnly: false, // Readable by client
                    maxAge: COOKIE_MAX_AGE
                });
            }
        }

        if (validToken.discordId) {
            (await cookies()).set(IDENTITY_COOKIES.discord, signValue(validToken.discordId), identityCookieOptions());
            // Also set username for display
            if (validToken.discordUsername) {
                (await cookies()).set("tabletop_user_discord_name", validToken.discordUsername, {
                    ...COOKIE_BASE_OPTIONS,
                    httpOnly: false, // Readable by client
                    maxAge: COOKIE_MAX_AGE
                });
            }
        }

        // 4. Cleanup Token (One-time use)
        // MOVED TO CRON: We keep tokens valid until expiry to prevent "Link Preview" race conditions.
        // Automated previews consume the token immediately otherwise.

        log.info("Magic Link login successful", { scope: "global", identifier: validToken.chatId || validToken.discordId });
        return redirectTo("/profile?success=logged_in");

    } catch (e) {
        log.error("Global Magic Link error", e as Error);
        return redirectTo("/profile?error=server_error");
    }
}

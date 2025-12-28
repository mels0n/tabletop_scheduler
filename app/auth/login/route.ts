import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import Logger from "@/lib/logger";
import { getBaseUrl } from "@/lib/url";
import { cookies } from "next/headers";

const log = Logger.get("Auth:Global");

export const dynamic = 'force-dynamic'; // Intent: Ensure no caching prevents token redemption.

/**
 * @function GET
 * @description Handles "Global Magic Link" login.
 *
 * Flow:
 * 1. User clicks link from Telegram (`/auth/login?token=abc`).
 * 2. System validates the ephemeral token (expires in 15 min).
 * 3. On Success: Sets a global `tabletop_user_chat_id` cookie (persistent for 30 days).
 * 4. Redirects to the User Profile page.
 *
 * Security Note:
 * Tokens are NOT deleted immediately upon use to prevent "Link Preview" race conditions
 * where a crawler consumes the token before the user's browser loads.
 *
 * @param {NextRequest} request - Incoming request with `token` query param.
 * @returns {NextResponse} Redirect to profile or error page.
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");
    const baseUrl = getBaseUrl(request.headers);

    if (!token) {
        return NextResponse.redirect(`${baseUrl}/profile?error=missing_token`);
    }

    try {
        // 1. Find Token
        const validToken = await prisma.loginToken.findUnique({
            where: { token }
        });

        // 2. Validate
        if (!validToken) {
            log.warn("Invalid Magic Link attempt");
            return NextResponse.redirect(`${baseUrl}/profile?error=invalid_token`);
        }

        if (new Date() > validToken.expiresAt) {
            log.warn("Expired Global Magic Link attempt");
            return NextResponse.redirect(`${baseUrl}/profile?error=expired_token`);
        }

        // 3. Set Cookie (HTTP Only, Secure)
        // 3. Set Cookie (HTTP Only, Secure)
        // Intent: Authenticate the user globally across the app based on their Telegram Chat ID OR Discord ID.
        if (validToken.chatId) {
            cookies().set("tabletop_user_chat_id", validToken.chatId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
                maxAge: 60 * 60 * 24 * 30
            });
        }

        if (validToken.discordId) {
            cookies().set("tabletop_user_discord_id", validToken.discordId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
                maxAge: 60 * 60 * 24 * 30
            });
            // Also set username for display
            if (validToken.discordUsername) {
                cookies().set("tabletop_user_discord_name", validToken.discordUsername, {
                    httpOnly: false, // Readable by client
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "lax",
                    path: "/",
                    maxAge: 60 * 60 * 24 * 30
                });
            }
        }

        // 4. Cleanup Token (One-time use)
        // MOVED TO CRON: We keep tokens valid until expiry to prevent "Link Preview" race conditions.
        // Automated previews consume the token immediately otherwise.

        log.info("Global Magic Link login successful", { chatId: validToken.chatId });
        return NextResponse.redirect(`${baseUrl}/profile?success=logged_in`);

    } catch (e) {
        log.error("Global Magic Link error", e as Error);
        return NextResponse.redirect(`${baseUrl}/profile?error=server_error`);
    }
}

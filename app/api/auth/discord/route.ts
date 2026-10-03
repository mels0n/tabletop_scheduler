import { NextResponse } from "next/server";
import { getBaseUrl } from "@/shared/lib/url";
import { getServerConfig } from "@/shared/config/server";
import {
    OAUTH_NONCE_COOKIE,
    OAUTH_NONCE_COOKIE_PATH,
    OAUTH_NONCE_MAX_AGE,
    encodeOAuthState,
    newOAuthNonce,
    safeReturnTo,
} from "@/features/integrations/discord";

// Reads the query string and must never be prerendered (it no longer touches request headers).
export const dynamic = "force-dynamic";

/**
 * @function GET
 * @description Handles the OAuth2 redirection flow for Discord.
 * Supports two modes: 'login' (identity only) and 'connect' (add bot to server).
 *
 * `state` carries a random nonce that is also set as a short-lived httpOnly cookie; the
 * callback rejects any state whose nonce does not match, which stops login CSRF (an
 * attacker completing the flow with their own `code` in the victim's browser).
 *
 * @param {Request} req - The incoming request.
 * @returns {NextResponse} Redirects the user to the Discord OAuth authorization URL.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const baseUrl = getBaseUrl();
    const returnTo = safeReturnTo(searchParams.get("returnTo") ?? "/", baseUrl);
    const flow = searchParams.get("flow") === "connect" ? "connect" : "login";

    const clientId = process.env.DISCORD_APP_ID;
    if (!clientId) {
        return NextResponse.json({ error: "Missing DISCORD_APP_ID" }, { status: 500 });
    }

    const redirectUri = `${baseUrl}/api/auth/discord/callback`;
    const nonce = newOAuthNonce();

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        state: encodeOAuthState({ nonce, flow, returnTo }),
    });

    if (flow === "connect") {
        // Add Bot flow. Permissions 93184 = View Channel (1024) + Send Messages (2048)
        // + Manage Messages (8192, for pinning) + Embed Links (16384) + Read History (65536).
        // 'identify' tells us who added the bot.
        params.set("scope", "bot identify");
        params.set("permissions", "93184");
    } else {
        params.set("scope", "identify");
    }

    const res = NextResponse.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
    res.cookies.set(OAUTH_NONCE_COOKIE, nonce, {
        httpOnly: true,
        secure: getServerConfig().nodeEnv === "production",
        // Lax: the callback is a top-level GET navigation back from discord.com.
        sameSite: "lax",
        path: OAUTH_NONCE_COOKIE_PATH,
        maxAge: OAUTH_NONCE_MAX_AGE,
    });
    return res;
}

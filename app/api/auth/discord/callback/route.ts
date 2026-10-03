import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBaseUrl } from "@/shared/lib/url";

// Reads the query string and must never be prerendered (it no longer touches request headers).
export const dynamic = "force-dynamic";
import Logger from "@/shared/lib/logger";

const log = Logger.get("Auth:Discord");

import { verifyEventAdmin } from "@/features/auth";
import { COOKIE_MAX_AGE, COOKIE_BASE_OPTIONS } from "@/shared/lib/auth-cookie";
import { identityCookieOptions, IDENTITY_COOKIES, signIdentity, signValue } from "@/shared/lib/session";
import prisma from "@/shared/lib/prisma";
import { normalizeHandle } from "@/shared/lib/handle";
import { getServerConfig } from "@/shared/config/server";
import {
    GUILD_GRANT_MAX_AGE,
    OAUTH_NONCE_COOKIE,
    OAUTH_NONCE_COOKIE_PATH,
    guildCookieName,
    guildGrantPurpose,
    isDiscordSnowflake,
    manageSlugFrom,
    nonceMatches,
    parseOAuthState,
} from "@/features/integrations/discord";

/** Redirects to a same-origin path (already allow-listed by parseOAuthState) with extra query params. */
function redirectTo(path: string, baseUrl: string, params: Record<string, string> = {}) {
    const url = new URL(path, baseUrl);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return NextResponse.redirect(url);
}

/**
 * Links the Discord account as the event's manager, but only for a caller who is already
 * the event admin, and only when no Discord manager is set. The admin token is never
 * rotated here: the signed identity cookie is what grants the manager admin later.
 */
async function linkManagerIfAdmin(returnTo: string, user: { id: string; username: string }) {
    const slug = manageSlugFrom(returnTo);
    if (!slug || !isDiscordSnowflake(user.id)) return;

    const event = await prisma.event.findUnique({
        where: { slug },
        select: { id: true, managerDiscordId: true },
    });
    if (!event) return;

    if (event.managerDiscordId === user.id) {
        log.info("Manager signed in via Discord", { slug });
        return;
    }
    if (event.managerDiscordId) return;

    if (!(await verifyEventAdmin(slug))) {
        log.warn("Refused Discord manager claim: caller is not the event admin", { slug });
        return;
    }

    await prisma.event.update({
        where: { id: event.id },
        data: {
            managerDiscordId: user.id,
            // Discord usernames are case-sensitive and arrive '@'-less via OAuth;
            // strip a stray '@' defensively but preserve case.
            managerDiscordUsername: normalizeHandle(user.username, { lowercase: false }),
        },
    });
    log.info("Manager linked Discord account", { slug });
}

/**
 * @function GET
 * @description Handles the OAuth2 callback from Discord.
 * Verifies the state nonce, exchanges the code for an access token, fetches the user
 * profile, and sets session cookies.
 *
 * @param {Request} req - The incoming callback request.
 * @returns {NextResponse} Redirects the user to the (same-origin) return path.
 */
export async function GET(req: Request) {
    const baseUrl = getBaseUrl();
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const stateStr = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
        return NextResponse.redirect(new URL("/?error=discord_auth_failed", baseUrl));
    }

    if (!code || !stateStr) {
        return NextResponse.json({ error: "Invalid Request" }, { status: 400 });
    }

    const cookieStore = await cookies();

    // CSRF: the nonce in state must match the cookie set when this browser started the flow.
    const state = parseOAuthState(stateStr, baseUrl);
    if (!state || !nonceMatches(cookieStore.get(OAUTH_NONCE_COOKIE)?.value, state.nonce)) {
        log.warn("Rejected Discord OAuth callback: missing or mismatched state nonce");
        return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
    }
    cookieStore.delete({ name: OAUTH_NONCE_COOKIE, path: OAUTH_NONCE_COOKIE_PATH });

    const { returnTo, flow } = state;
    const clientId = getServerConfig().discord.appId ?? undefined;
    const clientSecret = getServerConfig().discord.clientSecret ?? undefined;
    const redirectUri = `${baseUrl}/api/auth/discord/callback`;

    if (!clientId || !clientSecret) {
        log.error("Missing Discord Config");
        return NextResponse.json({ error: "Server Config Error" }, { status: 500 });
    }

    // 1. Exchange Code for Token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
        }),
    });

    if (!tokenRes.ok) {
        const err = await tokenRes.text();
        log.error("Token Exchange Failed", { error: err });
        return redirectTo(returnTo, baseUrl, { error: "token_failed" });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Bot-add flow: Discord returns the guild in the server-to-server token response. Only
    // that value is trusted; the `guild_id` query param is user-editable.
    const connectedGuildId: unknown = tokenData.guild?.id;

    // 2. Fetch User Profile
    const userRes = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
        return redirectTo(returnTo, baseUrl, { error: "profile_failed" });
    }

    const user = await userRes.json();

    // 3. Handle Flow Logic
    // Intent: Use shared configuration for 400-day persistence
    const cookieOpts = {
        ...COOKIE_BASE_OPTIONS,
        maxAge: COOKIE_MAX_AGE,
    };

    if (flow === "login") {
        // --- LOGIN FLOW ---
        // Set Identity Cookie
        cookieStore.set(IDENTITY_COOKIES.discord, signIdentity("discord", user.id), identityCookieOptions());

        // Optional: Set Username cookie for display
        cookieStore.set("tabletop_user_discord_name", user.username, { ...cookieOpts, httpOnly: false }); // readable by client

        // Returning to a manage page: link this Discord account as the manager if the
        // caller is already the event admin (so Discord can recover access later).
        await linkManagerIfAdmin(returnTo, user);

        return redirectTo(returnTo, baseUrl);
    }

    // --- CONNECT FLOW (Add Bot) ---
    // The UI finishes the binding by picking a channel. That step only accepts the guild
    // this admin just added the bot to, recorded here in a signed, short-lived cookie.
    cookieStore.set(IDENTITY_COOKIES.discord, signIdentity("discord", user.id), identityCookieOptions());
    cookieStore.set("tabletop_user_discord_name", user.username, { ...cookieOpts, httpOnly: false });

    const params: Record<string, string> = { discord_connected: "true" };
    if (isDiscordSnowflake(connectedGuildId)) {
        params.guild_id = connectedGuildId;
        const slug = manageSlugFrom(returnTo);
        if (slug && (await verifyEventAdmin(slug))) {
            cookieStore.set(guildCookieName(slug), signValue(guildGrantPurpose(slug), connectedGuildId), {
                ...COOKIE_BASE_OPTIONS,
                maxAge: GUILD_GRANT_MAX_AGE,
            });
        }
    }

    return redirectTo(returnTo, baseUrl, params);
}

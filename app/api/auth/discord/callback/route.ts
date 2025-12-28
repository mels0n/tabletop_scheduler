import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBaseUrl } from "@/lib/url";
import Logger from "@/lib/logger";

const log = Logger.get("Auth:Discord");

/**
 * @function GET
 * @description Handles the OAuth2 callback from Discord.
 * Exchanges the code for an access token, fetches user profile, and sets session cookies.
 *
 * @param {Request} req - The incoming callback request.
 * @returns {NextResponse} Redirects the user to the return URL or error page.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const stateStr = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
        return NextResponse.redirect(new URL("/?error=discord_auth_failed", req.url));
    }

    if (!code || !stateStr) {
        return NextResponse.json({ error: "Invalid Request" }, { status: 400 });
    }

    let state;
    try {
        state = JSON.parse(stateStr);
    } catch (e) {
        return NextResponse.json({ error: "Invalid State" }, { status: 400 });
    }

    const { returnTo, flow } = state;
    const clientId = process.env.DISCORD_APP_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const baseUrl = getBaseUrl(req.headers);
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
        return NextResponse.redirect(new URL(`${returnTo}?error=token_failed`, req.url));
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Capture Guild Info if available (Connect Flow)
    // When adding a bot, `guild` is often returned in this response.
    const connectedGuild = tokenData.guild;

    // 2. Fetch User Profile
    const userRes = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
        return NextResponse.redirect(new URL(`${returnTo}?error=profile_failed`, req.url));
    }

    const user = await userRes.json();

    // 3. Handle Flow Logic
    const cookieStore = cookies();
    const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict" as const,
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
    };

    if (flow === "login") {
        // --- LOGIN FLOW ---
        // Set Identity Cookie
        cookieStore.set("tabletop_user_discord_id", user.id, cookieOpts);

        // Optional: Set Username cookie for display
        cookieStore.set("tabletop_user_discord_name", user.username, { ...cookieOpts, httpOnly: false }); // readable by client

        return NextResponse.redirect(new URL(returnTo, req.url));
    }
    else if (flow === "connect") {
        // --- CONNECT FLOW (Add Bot) ---
        // We don't login the user, we just return the connection status to the Manage Page.

        // However, we SHOULD update the Event Manager's Discord ID if possible? 
        // We don't have the Event Slug here easily unless passed in state.
        // But the UI can handle the save if we return successfully.

        // Let's pass the guild_id back to validity check.
        const guildParam = connectedGuild ? `&guild_id=${connectedGuild.id}` : "";

        // Also set the "Manager" cookie implicitly so they don't have to login separately? 
        // Yes, if you connect the bot, you are arguably the manager.
        cookieStore.set("tabletop_user_discord_id", user.id, cookieOpts);
        cookieStore.set("tabletop_user_discord_name", user.username, { ...cookieOpts, httpOnly: false });

        return NextResponse.redirect(new URL(`${returnTo}?discord_connected=true${guildParam}`, req.url));
    }

    return NextResponse.redirect(new URL("/", req.url));
}

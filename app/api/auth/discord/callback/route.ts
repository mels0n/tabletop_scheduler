import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBaseUrl } from "@/shared/lib/url";
import Logger from "@/shared/lib/logger";

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

    // Intent: Use shared configuration for 400-day persistence
    const { COOKIE_MAX_AGE, COOKIE_BASE_OPTIONS } = await import("@/shared/lib/auth-cookie");
    const cookieOpts = {
        ...COOKIE_BASE_OPTIONS,
        maxAge: COOKIE_MAX_AGE,
    };

    if (flow === "login") {
        // --- LOGIN FLOW ---
        // Set Identity Cookie
        cookieStore.set("tabletop_user_discord_id", user.id, cookieOpts);

        // Optional: Set Username cookie for display
        cookieStore.set("tabletop_user_discord_name", user.username, { ...cookieOpts, httpOnly: false }); // readable by client

        // MAGIC LINK / RECOVERY LOGIC
        // Intent: If the user is returning to a /manage page, try to restore their Admin Access automatically.
        // This acts as the "Magic Link" for Discord users.
        if (returnTo.includes("/manage")) {
            // Extract slug from path: /e/[slug]/manage
            const match = returnTo.match(/\/e\/([^\/]+)\/manage/);
            if (match && match[1]) {
                const slug = match[1];
                const { setAdminCookie } = await import("@/features/auth/server/actions");
                const prisma = (await import("@/shared/lib/prisma")).default;

                const event = await prisma.event.findUnique({ where: { slug } });

                // Verify: Does this Discord User own this event?
                // Verify: Does this Discord User own this event?
                if (event && event.managerDiscordId === user.id) {
                    // Success! Restore the admin session.
                    // CRITICAL: We only have the HASH in the DB. We cannot set the cookie to the Hash,
                    // because verifyEventAdmin expects Cookie(Plaintext) -> Hash(Cookie) === DB(Hash).
                    // Solution: Rotate the token.
                    const { hashToken } = await import("@/shared/lib/token");
                    const { v4: uuidv4 } = await import("uuid");

                    const newToken = uuidv4();
                    const newHash = hashToken(newToken);

                    await prisma.event.update({
                        where: { id: event.id },
                        data: { adminToken: newHash }
                    });

                    await setAdminCookie(slug, newToken);
                    log.info("Manager session restored via Discord (Token Rotated)", { slug, userId: user.id });
                } else if (event && !event.managerDiscordId) {
                    // Claiming: If no Discord ID is set but they are logging in via the Manage page...
                    // Allow the user to "Claim" this event as the manager since they had the admin link.
                    const { hashToken } = await import("@/shared/lib/token");
                    const { v4: uuidv4 } = await import("uuid");

                    const newToken = uuidv4();
                    const newHash = hashToken(newToken);

                    await prisma.event.update({
                        where: { id: event.id },
                        data: {
                            managerDiscordId: user.id,
                            managerDiscordUsername: user.username,
                            adminToken: newHash
                        }
                    });

                    // Also set the admin cookie now that they are linked
                    await setAdminCookie(slug, newToken);

                    log.info("Manager claimed event via Discord", { slug, userId: user.id });
                }
            }
        }

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

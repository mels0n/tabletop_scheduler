import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/url";

/**
 * @function GET
 * @description Handles the OAuth2 redirection flow for Discord.
 * Supports two modes: 'login' (identity only) and 'connect' (add bot to server).
 *
 * @param {Request} req - The incoming request.
 * @returns {NextResponse} Redirects the user to the Discord OAuth authorization URL.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const returnTo = searchParams.get("returnTo") || "/";
    const flow = searchParams.get("flow") || "login"; // 'login' or 'connect'

    const clientId = process.env.DISCORD_APP_ID;
    if (!clientId) {
        return NextResponse.json({ error: "Missing DISCORD_APP_ID" }, { status: 500 });
    }

    const baseUrl = getBaseUrl(req.headers);
    const redirectUri = `${baseUrl}/api/auth/discord/callback`;

    // Define scopes based on flow
    // Login: Identify (just need ID/User)
    // Connect: Identify + Bot Permissions (if adding bot)
    let scope = "identify";

    // If 'connect', we might be adding the bot to a server.
    // Actually, adding a bot requires 'bot' scope and 'permissions'.
    // BUT, usually we want to "Add to Server" which is a slightly different flow than "Login".
    // "Add Bot" URL: https://discord.com/oauth2/authorize?client_id=...&scope=bot&permissions=...
    // "Login" URL: https://discord.com/oauth2/authorize?client_id=...&response_type=code&scope=identify

    // The user wants "Channel Picker", which implies we need to list channels.
    // To list channels, the BOT needs to be in the server.
    // THE USER needs to authorize us to fetch their guilds? No, the BOT fetches channels.
    // So we just need to Add the Bot to the server.

    // Strategy:
    // 1. "Connect" flow = Add Bot Flow.
    // 2. "Login" flow = User Identity Flow.

    let url = "https://discord.com/oauth2/authorize";
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        state: JSON.stringify({ returnTo, flow }) // Pass state to recall where to go
    });

    if (flow === "connect") {
        // Add Bot Flow
        // We need 'bot' scope and 'applications.commands' (maybe?)
        // Permissions: 
        // - Manage Messages (0x2000) - For Pinning
        // - Send Messages (0x800)
        // - Read Messages/View Channels (0x400)
        // - Embed Links (0x4000)
        // Calculator: https://discordapi.com/permissions.html
        // Combine: 0x2000 | 0x800 | 0x400 | 0x4000 = 8192 + 2048 + 1024 + 16384 = 27648? No wait.
        // Let's use a safe integer: 93184 (View(1024) + Send(2048) + ManageMsgs(8192) + Embed(16384) + ReadHistory(65536))

        params.set("scope", "bot identify");
        params.set("permissions", "93184");
        // Note: 'identify' is needed to know WHO added the bot (for linking managerDiscordId if usually)
    } else {
        // Login Flow
        params.set("scope", "identify");
    }

    return NextResponse.redirect(`${url}?${params.toString()}`);
}

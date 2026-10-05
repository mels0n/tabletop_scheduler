import { getServerConfig } from "@/shared/config/server";

/**
 * True when Discord OAuth can complete end to end: the authorize route needs the app id
 * and the callback's token exchange also needs the client secret. Pages use this to hide
 * Discord login and connect links on installs (and Vercel previews) without Discord, so a
 * click never lands on the route's raw config error.
 */
export function isDiscordOAuthConfigured(): boolean {
    const { appId, clientSecret } = getServerConfig().discord;
    return Boolean(appId && clientSecret);
}

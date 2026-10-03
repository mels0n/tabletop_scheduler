import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Discord OAuth `state` handling: a CSRF nonce bound to a short-lived cookie, plus a
 * same-origin allow-list for the post-login redirect.
 */

export const OAUTH_NONCE_COOKIE = "tabletop_oauth_nonce";
/** Scoped to the OAuth routes so the nonce is not sent with every request. */
export const OAUTH_NONCE_COOKIE_PATH = "/api/auth/discord";
export const OAUTH_NONCE_MAX_AGE = 10 * 60;

/** Lifetime of the per-event "this admin just added the bot to guild X" grant. */
export const GUILD_GRANT_MAX_AGE = 60 * 60;

export type OAuthFlow = "login" | "connect";

export interface OAuthState {
    nonce: string;
    flow: OAuthFlow;
    returnTo: string;
}

export function newOAuthNonce(): string {
    return randomBytes(16).toString("base64url");
}

/**
 * Only a same-origin relative path survives; anything else becomes "/". The regex rejects
 * absolute and protocol-relative URLs (including the `/\` form browsers treat as `//`);
 * the origin check catches what the URL parser normalises (tabs, newlines).
 */
export function safeReturnTo(raw: unknown, baseUrl: string): string {
    if (typeof raw !== "string" || !/^\/(?![/\\])/.test(raw)) return "/";
    try {
        const base = new URL(baseUrl);
        const resolved = new URL(raw, base);
        if (resolved.origin !== base.origin) return "/";
        return `${resolved.pathname}${resolved.search}${resolved.hash}`;
    } catch {
        return "/";
    }
}

export function encodeOAuthState(state: OAuthState): string {
    return JSON.stringify(state);
}

/** Null when the state is unparsable or has no nonce. Flow and returnTo are normalised. */
export function parseOAuthState(raw: string | null, baseUrl: string): OAuthState | null {
    if (!raw) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (typeof parsed !== "object" || parsed === null) return null;
    const { nonce, flow, returnTo } = parsed as Record<string, unknown>;
    if (typeof nonce !== "string" || nonce.length === 0) return null;
    return {
        nonce,
        flow: flow === "connect" ? "connect" : "login",
        returnTo: safeReturnTo(returnTo, baseUrl),
    };
}

export function nonceMatches(expected: string | undefined | null, given: string | undefined | null): boolean {
    if (!expected || !given) return false;
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(given, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
}

/** The event slug when `returnTo` is that event's manage page, else null. */
export function manageSlugFrom(returnTo: string): string | null {
    const match = returnTo.match(/^\/e\/([A-Za-z0-9_-]+)\/manage(?:[/?#]|$)/);
    return match ? match[1] : null;
}

export function isDiscordSnowflake(id: unknown): id is string {
    return typeof id === "string" && /^\d{17,20}$/.test(id);
}

/** Signed cookie naming the guild the event admin just added the bot to. */
export function guildCookieName(slug: string): string {
    return `tabletop_discord_guild_${slug}`;
}

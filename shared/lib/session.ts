import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerConfig } from "@/shared/config/server";

/**
 * HMAC-signed cookie values, domain separated by purpose.
 *
 * A signed value is `${value}.${base64url(HMAC-SHA256(secret, `${purpose}\0${value}`))}`.
 * The purpose is not stored in the cookie: the reader names the purpose it expects, so a
 * value signed for one use (a participant row id, a guild id) never verifies as another
 * (a Telegram chat id). Identity cookies are only trusted after `verifyValue`, so a forged
 * raw platform ID is ignored.
 */

export const IDENTITY_COOKIES = {
    telegram: "tabletop_user_chat_id",
    discord: "tabletop_user_discord_id",
} as const;

export type IdentityPlatform = keyof typeof IDENTITY_COOKIES;

/** Signing purpose of each global identity cookie. */
export const IDENTITY_PURPOSES = {
    telegram: "identity:telegram",
    discord: "identity:discord",
} as const satisfies Record<IdentityPlatform, string>;

/** Cookie proving this browser created a participant row on the event `slug`. */
export function participantCookieName(slug: string): string {
    return `tabletop_participant_${slug}`;
}

/** Signing purpose of the participant cookie for the event `slug`. */
export function participantPurpose(slug: string): string {
    return `participant:${slug}`;
}

/** 400 days, the browser maximum for cookie lifetime. */
const IDENTITY_MAX_AGE = 60 * 60 * 24 * 400;

function mac(purpose: string, value: string): Buffer {
    if (!purpose || purpose.includes("\0")) {
        throw new Error("Signing purpose must be a non-empty string without NUL");
    }
    return createHmac("sha256", getServerConfig().sessionSecret)
        .update(`${purpose}\0${value}`, "utf8")
        .digest();
}

export function signValue(purpose: string, value: string): string {
    return `${value}.${mac(purpose, value).toString("base64url")}`;
}

/**
 * Returns the original value when the signature matches for `purpose`, else null
 * (including unsigned input and values signed for a different purpose).
 */
export function verifyValue(purpose: string, signed: string | undefined | null): string | null {
    if (!signed) return null;
    const dot = signed.lastIndexOf(".");
    if (dot <= 0 || dot === signed.length - 1) return null;

    const value = signed.slice(0, dot);
    const sig = signed.slice(dot + 1);
    if (!/^[A-Za-z0-9_-]+$/.test(sig)) return null;

    const given = Buffer.from(sig, "base64url");
    const expected = mac(purpose, value);
    if (given.length !== expected.length) return null;
    return timingSafeEqual(given, expected) ? value : null;
}

export interface CookieReader {
    get(name: string): { value: string } | undefined;
}

/** The verified platform ID from one identity cookie, or null. */
export function readIdentityCookie(store: CookieReader, platform: IdentityPlatform): string | null {
    return verifyValue(IDENTITY_PURPOSES[platform], store.get(IDENTITY_COOKIES[platform])?.value);
}

/** Reads the signed identity cookies from any `{ get(name) }` store (next/headers cookies, NextRequest.cookies). */
export function readIdentity(store: CookieReader): { chatId: string | null; discordId: string | null } {
    return {
        chatId: readIdentityCookie(store, "telegram"),
        discordId: readIdentityCookie(store, "discord"),
    };
}

/** Client-readable display-name cookie set beside the Discord identity cookie. */
export const DISCORD_NAME_COOKIE = "tabletop_user_discord_name";

/**
 * The Discord display name from its cookie, or null when absent or implausible. The cookie
 * is client-writable: use it only as a label beside a verified Discord ID, and never to
 * replace a stored username.
 */
export function readDiscordDisplayName(store: CookieReader): string | null {
    const raw = store.get(DISCORD_NAME_COOKIE)?.value?.trim();
    if (!raw || raw.length > 64 || [...raw].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)) return null;
    return raw;
}

/** Signs a platform ID for its identity cookie. */
export function signIdentity(platform: IdentityPlatform, id: string): string {
    return signValue(IDENTITY_PURPOSES[platform], id);
}

export function identityCookieOptions(): { httpOnly: true; secure: boolean; sameSite: "lax"; path: "/"; maxAge: number } {
    return {
        httpOnly: true,
        secure: getServerConfig().nodeEnv === "production",
        // Lax covers magic links and the OAuth callback (top-level navigations).
        sameSite: "lax",
        path: "/",
        maxAge: IDENTITY_MAX_AGE,
    };
}

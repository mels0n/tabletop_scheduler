import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerConfig } from "@/shared/config/server";

/**
 * HMAC-signed cookie values. A signed value is `${value}.${base64url(HMAC-SHA256(secret, value))}`.
 * Identity cookies are only trusted after `verifyValue`, so a forged raw platform ID is ignored.
 */

export const IDENTITY_COOKIES = {
    telegram: "tabletop_user_chat_id",
    discord: "tabletop_user_discord_id",
} as const;

/** 400 days, the browser maximum for cookie lifetime. */
const IDENTITY_MAX_AGE = 60 * 60 * 24 * 400;

function mac(value: string): Buffer {
    return createHmac("sha256", getServerConfig().sessionSecret).update(value, "utf8").digest();
}

export function signValue(value: string): string {
    return `${value}.${mac(value).toString("base64url")}`;
}

/** Returns the original value when the signature matches, else null (including unsigned input). */
export function verifyValue(signed: string | undefined | null): string | null {
    if (!signed) return null;
    const dot = signed.lastIndexOf(".");
    if (dot <= 0 || dot === signed.length - 1) return null;

    const value = signed.slice(0, dot);
    const sig = signed.slice(dot + 1);
    if (!/^[A-Za-z0-9_-]+$/.test(sig)) return null;

    const given = Buffer.from(sig, "base64url");
    const expected = mac(value);
    if (given.length !== expected.length) return null;
    return timingSafeEqual(given, expected) ? value : null;
}

export interface CookieReader {
    get(name: string): { value: string } | undefined;
}

/** Reads the signed identity cookies from any `{ get(name) }` store (next/headers cookies, NextRequest.cookies). */
export function readIdentity(store: CookieReader): { chatId: string | null; discordId: string | null } {
    return {
        chatId: verifyValue(store.get(IDENTITY_COOKIES.telegram)?.value),
        discordId: verifyValue(store.get(IDENTITY_COOKIES.discord)?.value),
    };
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

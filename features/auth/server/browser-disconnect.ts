"use server";

import Logger from "@/shared/lib/logger";
import { cookies } from "next/headers";

const log = Logger.get("BrowserDisconnect");

type Platform = 'telegram' | 'discord';

const PLATFORM_LABEL: Record<Platform, string> = {
    telegram: 'Telegram',
    discord: 'Discord',
};

/** httpOnly cookie set by each platform's verified magic-link/OAuth flow. */
const PLATFORM_ID_COOKIE: Record<Platform, string> = {
    telegram: 'tabletop_user_chat_id',
    discord: 'tabletop_user_discord_id',
};

/** Companion display-name cookie cleared alongside the identity cookie. */
const PLATFORM_NAME_COOKIE: Record<Platform, string> = {
    telegram: 'tabletop_user_telegram_name',
    discord: 'tabletop_user_discord_name',
};

/**
 * @function disconnectPlatformFromBrowser
 * @description Browser-level sign-out for one platform's sync: deletes the caller's
 * session cookies for that platform and nothing else. All database records (participant
 * links, manager identity, login tokens) are left intact, so votes and events keep their
 * platform identity and the user can re-sync this or any other browser at any time.
 *
 * This is deliberately the non-destructive counterpart of `unlinkPlatformEverywhere`
 * (identity-unlink.ts), which is the account-level "unlink and delete my data" path.
 *
 * @param {Platform} platform - Which platform ('telegram' | 'discord') to sign out of.
 * @returns {Promise<{ success: true, message: string } | { error: string }>}
 */
export async function disconnectPlatformFromBrowser(platform: Platform): Promise<{ success: true, message: string } | { error: string }> {
    try {
        const cookieStore = cookies();
        const identityId = cookieStore.get(PLATFORM_ID_COOKIE[platform])?.value;

        if (!identityId) {
            return { error: `Not synced with ${PLATFORM_LABEL[platform]} on this browser.` };
        }

        cookieStore.delete(PLATFORM_ID_COOKIE[platform]);
        cookieStore.delete(PLATFORM_NAME_COOKIE[platform]);

        log.info("Disconnected platform from browser", { platform });
        return {
            success: true,
            message: `${PLATFORM_LABEL[platform]} disconnected from this browser. Your events and votes are kept, and you can reconnect anytime.`
        };
    } catch (e) {
        log.error("Failed to disconnect platform from browser", e as Error);
        return { error: "System error. Please try again." };
    }
}

"use server";

import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { cookies } from "next/headers";
import { IDENTITY_COOKIES, readIdentityCookie } from "@/shared/lib/session";
import { platformParam } from "@/shared/lib/action-params";

const log = Logger.get("IdentityUnlink");

type Platform = 'telegram' | 'discord';

const PLATFORM_LABEL: Record<Platform, string> = {
    telegram: 'Telegram',
    discord: 'Discord',
};

/** Signed httpOnly cookie set by each platform's verified magic-link/OAuth flow. */
const PLATFORM_ID_COOKIE: Record<Platform, string> = {
    telegram: IDENTITY_COOKIES.telegram,
    discord: IDENTITY_COOKIES.discord,
};

/** Companion display-name cookie cleared alongside the identity cookie. */
const PLATFORM_NAME_COOKIE: Record<Platform, string> = {
    telegram: 'tabletop_user_telegram_name',
    discord: 'tabletop_user_discord_name',
};

/**
 * @function unlinkPlatformEverywhere
 * @description Account-level "unlink and delete my data" for one platform. The caller's
 * verified identity is read from their httpOnly session cookie (the OAuth/magic-link flow
 * is what set it, so possessing it proves ownership of the platform account), then that
 * identity is wiped from every place it is stored:
 *
 * - Participant rows across all events (Discord: id + username; Telegram: the verified
 *   numeric chatId — the user-typed handle text is their own input, not platform API data,
 *   and per-participant unlink preserves it the same way).
 * - Manager identity on every event they manage (this removes that platform's magic-link
 *   recovery for those events — the UI must warn before calling).
 * - Their pending LoginToken rows.
 * - Their DmPreference row for that platform.
 * - The session cookies themselves.
 *
 * This is the self-serve data-deletion path required by Discord's Developer ToS §5(b):
 * after it runs, no API Data for that platform identity remains in the database.
 *
 * @param {Platform} platform - Which identity ('telegram' | 'discord') to erase.
 * @returns {Promise<{ success: true, message: string } | { error: string }>}
 */
export async function unlinkPlatformEverywhere(platform: Platform): Promise<{ success: true, message: string } | { error: string }> {
    // Public endpoint: only the two known platforms may select a cookie name or a delete filter.
    if (!platformParam.safeParse(platform).success) return { error: "Invalid request." };

    try {
        const cookieStore = await cookies();
        const identityId = readIdentityCookie(cookieStore, platform);

        if (!identityId) {
            return { error: `Not synced with ${PLATFORM_LABEL[platform]} on this browser.` };
        }

        // One transaction so a partial failure cannot leave the identity half erased.
        const { participantCount, eventCount } = await prisma.$transaction(async (tx) => {
            let participantCount: number;
            let eventCount: number;

            if (platform === 'discord') {
                participantCount = (await tx.participant.updateMany({
                    where: { discordId: identityId },
                    data: { discordId: null, discordUsername: null }
                })).count;

                eventCount = (await tx.event.updateMany({
                    where: { managerDiscordId: identityId },
                    data: { managerDiscordId: null, managerDiscordUsername: null }
                })).count;

                await tx.loginToken.deleteMany({ where: { discordId: identityId } });
            } else {
                participantCount = (await tx.participant.updateMany({
                    where: { chatId: identityId },
                    data: { chatId: null }
                })).count;

                eventCount = (await tx.event.updateMany({
                    where: { managerChatId: identityId },
                    data: { managerChatId: null }
                })).count;

                await tx.loginToken.deleteMany({ where: { chatId: identityId } });
            }

            await tx.dmPreference.deleteMany({ where: { platform, platformId: identityId } });

            return { participantCount, eventCount };
        });

        cookieStore.delete(PLATFORM_ID_COOKIE[platform]);
        cookieStore.delete(PLATFORM_NAME_COOKIE[platform]);

        log.info("Unlinked platform identity everywhere", { platform, participantCount, eventCount });
        return {
            success: true,
            message: `${PLATFORM_LABEL[platform]} unlinked. Your ${PLATFORM_LABEL[platform]} identity was removed from ${participantCount} participant record(s) and ${eventCount} event(s).`
        };
    } catch (e) {
        log.error("Failed to unlink platform identity", e as Error);
        return { error: "System error. Please try again." };
    }
}

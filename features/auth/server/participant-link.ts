"use server";

import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { cookies } from "next/headers";
import type { Participant } from "@prisma/client";

const log = Logger.get("ParticipantLink");

/**
 * @typedef {'telegram' | 'discord'} Platform
 * @description The identity platform being linked/unlinked. Drives which cookie and
 * which Participant identity column ("chatId" vs "discordId") is read/written.
 */
type Platform = 'telegram' | 'discord';

interface ParticipantLinkParams {
    slug: string;
    participantId: number;
    platform: Platform;
}

/** Human-readable platform names for user-facing error/success copy. */
const PLATFORM_LABEL: Record<Platform, string> = {
    telegram: 'Telegram',
    discord: 'Discord',
};

/** httpOnly cookie set by each platform's verified magic-link/OAuth flow. */
const PLATFORM_COOKIE: Record<Platform, string> = {
    telegram: 'tabletop_user_chat_id',
    discord: 'tabletop_user_discord_id',
};

/**
 * @function loadOwnedParticipant
 * @description Shared load/ownership-check step for link and unlink.
 * Resolves the event by slug, loads the participant by id, and verifies the
 * participant actually belongs to that event (prevents cross-event stamping via a
 * participantId borrowed from another event).
 *
 * @param {string} slug - The event slug.
 * @param {number} participantId - The Participant row being claimed/released.
 * @returns {Promise<{ participant: Participant } | { error: string }>} The participant row, or an error.
 */
async function loadOwnedParticipant(slug: string, participantId: number): Promise<{ participant: Participant } | { error: string }> {
    const event = await prisma.event.findUnique({
        where: { slug },
        select: { id: true }
    });
    if (!event) {
        return { error: "Event not found." };
    }

    const participant = await prisma.participant.findUnique({
        where: { id: participantId }
    });

    // Security: A participantId only grants rights to its own event's row (same trust
    // model as the vote route), so a mismatched eventId is treated as "not found".
    if (!participant || participant.eventId !== event.id) {
        return { error: "Participant not found for this event." };
    }

    return { participant };
}

/**
 * @function linkParticipant
 * @description Stamps the caller's verified platform identity (read from their httpOnly
 * cookie) onto an event Participant row, claiming an "unclaimed" vote as their own so it
 * surfaces on their profile going forward.
 *
 * Idempotent: re-linking a row already stamped with the caller's own identity is a no-op
 * success. Linking a row already claimed by a *different* verified identity is refused.
 *
 * @param {ParticipantLinkParams} params
 * @param {string} params.slug - The event slug.
 * @param {number} params.participantId - The Participant row to claim.
 * @param {Platform} params.platform - Which identity ('telegram' | 'discord') to stamp.
 * @returns {Promise<{ success: true, message?: string } | { error: string }>}
 */
export async function linkParticipant({ slug, participantId, platform }: ParticipantLinkParams): Promise<{ success: true, message?: string } | { error: string }> {
    try {
        const loaded = await loadOwnedParticipant(slug, participantId);
        if ('error' in loaded) return loaded;
        const { participant } = loaded;

        const cookieStore = cookies();
        const identityId = cookieStore.get(PLATFORM_COOKIE[platform])?.value;

        // Guard: UI shouldn't offer linking a platform the user hasn't synced, but a
        // stale page or replayed request could still hit this action without the cookie.
        if (!identityId) {
            return { error: `Not synced with ${PLATFORM_LABEL[platform]} on this browser.` };
        }

        if (platform === 'telegram') {
            if (participant.chatId) {
                // Already linked to this exact identity: treat as a successful no-op.
                if (participant.chatId === identityId) {
                    return { success: true };
                }
                return { error: "This participant is already linked to a different Telegram account." };
            }

            await prisma.participant.update({
                where: { id: participantId },
                data: { chatId: identityId }
            });
        } else {
            if (participant.discordId) {
                if (participant.discordId === identityId) {
                    return { success: true };
                }
                return { error: "This participant is already linked to a different Discord account." };
            }

            // Best-effort display name; not required to link (only client-readable, never
            // used for identity checks).
            const discordUsername = cookieStore.get('tabletop_user_discord_name')?.value;

            await prisma.participant.update({
                where: { id: participantId },
                data: {
                    discordId: identityId,
                    ...(discordUsername ? { discordUsername } : {})
                }
            });
        }

        log.info("Linked participant identity", { slug, participantId, platform });
        return { success: true, message: `Linked to your ${PLATFORM_LABEL[platform]} account.` };
    } catch (e) {
        log.error("Failed to link participant", e as Error);
        return { error: "System error. Please try again." };
    }
}

/**
 * @function unlinkParticipant
 * @description Clears the caller's verified platform identity from an event Participant
 * row. Only allowed when the row's identity column currently matches the caller's own
 * cookie identity, i.e. a user can only unlink themselves, never someone else's claim.
 *
 * Telegram unlink preserves `telegramId` (the user-entered handle text) and only clears
 * the verified numeric `chatId`. Discord unlink clears both `discordId` and
 * `discordUsername` since the username has no independent value once unlinked.
 *
 * @param {ParticipantLinkParams} params
 * @param {string} params.slug - The event slug.
 * @param {number} params.participantId - The Participant row to release.
 * @param {Platform} params.platform - Which identity ('telegram' | 'discord') to clear.
 * @returns {Promise<{ success: true, message?: string } | { error: string }>}
 */
export async function unlinkParticipant({ slug, participantId, platform }: ParticipantLinkParams): Promise<{ success: true, message?: string } | { error: string }> {
    try {
        const loaded = await loadOwnedParticipant(slug, participantId);
        if ('error' in loaded) return loaded;
        const { participant } = loaded;

        const cookieStore = cookies();
        const identityId = cookieStore.get(PLATFORM_COOKIE[platform])?.value;

        if (!identityId) {
            return { error: `Not synced with ${PLATFORM_LABEL[platform]} on this browser.` };
        }

        if (platform === 'telegram') {
            // Covers both "linked to someone else" and "already unlinked" (chatId null).
            if (participant.chatId !== identityId) {
                return { error: "This participant is not linked to your Telegram account." };
            }

            await prisma.participant.update({
                where: { id: participantId },
                data: { chatId: null }
            });
        } else {
            if (participant.discordId !== identityId) {
                return { error: "This participant is not linked to your Discord account." };
            }

            await prisma.participant.update({
                where: { id: participantId },
                data: { discordId: null, discordUsername: null }
            });
        }

        log.info("Unlinked participant identity", { slug, participantId, platform });
        return { success: true, message: `Unlinked from your ${PLATFORM_LABEL[platform]} account.` };
    } catch (e) {
        log.error("Failed to unlink participant", e as Error);
        return { error: "System error. Please try again." };
    }
}

/**
 * @function resolvePassiveChatId
 * @description Feature: Passive Identity Linking.
 * Given a handle-only telegramId with no verified numeric chatId yet, try to resolve one
 * so the participant isn't invisible to cross-device profile sync (which resolves events
 * strictly by numeric chatId, never by handle).
 *
 * Normalization: production data stores handles both with and without the leading '@'
 * ('pyaniz' vs '@mels0n'), so both forms are always matched regardless of which form the
 * caller passed in.
 *
 * Step 1: Look for another Participant row carrying this handle that already has a
 * verified chatId (the original passive-linking behavior).
 * Step 2 (fallback): Look at Event.managerTelegram / Event.managerChatId. A user who
 * manages one event and then votes on a friend's event under the same handle has no
 * Participant row anywhere with a chatId yet, but their own event's manager record is
 * already verified.
 *
 * Note: lives outside the route file because Next.js App Router route modules may only
 * export HTTP handlers and route config (enforced at build time).
 *
 * @param {any} tx - Prisma transaction client.
 * @param {string} telegramId - Handle as submitted by the client (with or without '@').
 * @returns {Promise<string | null>} The resolved numeric chatId, or null if none found.
 */
export async function resolvePassiveChatId(tx: any, telegramId: string): Promise<string | null> {
    const clean = telegramId.replace('@', '');
    const formatted = `@${clean}`;

    const participantMatch = await tx.participant.findFirst({
        where: {
            telegramId: { in: [clean, formatted] },
            NOT: { chatId: null }
        },
        select: { chatId: true }
    });
    if (participantMatch?.chatId) return participantMatch.chatId;

    const managerMatch = await tx.event.findFirst({
        where: {
            managerTelegram: { in: [clean, formatted] },
            NOT: { managerChatId: null }
        },
        select: { managerChatId: true }
    });
    if (managerMatch?.managerChatId) return managerMatch.managerChatId;

    return null;
}

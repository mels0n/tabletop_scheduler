import { describe, it, expect, vi, beforeEach } from 'vitest';
import { linkParticipant, unlinkParticipant } from './participant-link';
import { cookies } from 'next/headers';
import { signValue } from '@/shared/lib/session';
import prisma from '@/shared/lib/prisma';

vi.mock('@/shared/lib/prisma');

const mockPrisma = prisma as unknown as {
    event: { findUnique: ReturnType<typeof vi.fn> },
    participant: { findUnique: ReturnType<typeof vi.fn>, update: ReturnType<typeof vi.fn>, updateMany: ReturnType<typeof vi.fn> }
};

/** Cookie getter over a name -> value map. */
function jar(values: Record<string, string>) {
    return (name: string) => (name in values ? { value: values[name] } : undefined);
}

/** The signed participant cookie the vote route sets for row `id` on event `my-slug`. */
const OWNS_5 = { 'tabletop_participant_my-slug': signValue('participant:my-slug', '5') };

/** A row whose participant cookie has been issued: linking it needs that cookie. */
const MARKED = new Date('2026-10-03T12:00:00Z');

describe('participant-link actions', () => {
    const mockCookieStore = {
        get: vi.fn(),
        set: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        (cookies as any).mockReturnValue(mockCookieStore);
    });

    describe('linkParticipant', () => {
        it('links an unclaimed participant to the caller\'s Telegram identity', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'my-slug' });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, ownerCookieIssuedAt: MARKED, chatId: null });
            mockCookieStore.get.mockImplementation(jar({ ...OWNS_5, tabletop_user_chat_id: signValue('identity:telegram', '999') }));

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ success: true, message: expect.any(String) });
            expect(mockPrisma.participant.update).toHaveBeenCalledWith({
                where: { id: 5 },
                data: { chatId: '999' }
            });
        });

        it('links an unclaimed participant to the caller\'s Discord identity, including username', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'my-slug' });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, ownerCookieIssuedAt: MARKED, discordId: null });
            mockCookieStore.get.mockImplementation(jar({
                ...OWNS_5,
                tabletop_user_discord_id: signValue('identity:discord', 'discord-42'),
                tabletop_user_discord_name: 'ChrisM',
            }));

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'discord' });

            expect(result).toEqual({ success: true, message: expect.any(String) });
            expect(mockPrisma.participant.update).toHaveBeenCalledWith({
                where: { id: 5 },
                data: { discordId: 'discord-42', discordUsername: 'ChrisM' }
            });
        });

        it('refuses a forged unsigned Telegram identity cookie', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'my-slug' });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, ownerCookieIssuedAt: MARKED, chatId: null });
            mockCookieStore.get.mockImplementation(jar({ ...OWNS_5, tabletop_user_chat_id: '999' }));

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ error: expect.any(String) });
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });

        it('is idempotent when re-linking to the same Telegram identity', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'my-slug' });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, ownerCookieIssuedAt: MARKED, chatId: '999' });
            mockCookieStore.get.mockImplementation(jar({ ...OWNS_5, tabletop_user_chat_id: signValue('identity:telegram', '999') }));

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ success: true });
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });

        it('refuses to link a participant already claimed by a different Telegram account', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'my-slug' });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, ownerCookieIssuedAt: MARKED, chatId: '111' });
            mockCookieStore.get.mockImplementation(jar({ ...OWNS_5, tabletop_user_chat_id: signValue('identity:telegram', '999') }));

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ error: expect.stringContaining('already linked to a different Telegram account') });
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });

        it('refuses to link when the platform cookie is missing', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'my-slug' });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, ownerCookieIssuedAt: MARKED, chatId: null });
            mockCookieStore.get.mockImplementation(jar({ ...OWNS_5 }));

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ error: expect.stringContaining('Not synced with Telegram') });
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });

        it('refuses to link a participant that belongs to a different event', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'my-slug' });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 2, chatId: null });
            mockCookieStore.get.mockImplementation(jar({ ...OWNS_5, tabletop_user_chat_id: signValue('identity:telegram', '999') }));

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ error: expect.any(String) });
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });

        it('refuses a signed identity without the participant cookie for this row, updating nothing', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'my-slug' });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, ownerCookieIssuedAt: MARKED, chatId: null });
            mockCookieStore.get.mockImplementation(jar({ tabletop_user_chat_id: signValue('identity:telegram', '999') }));

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ error: expect.stringContaining('vote') });
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });

        it('refuses when the participant cookie names a different row', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'my-slug' });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, ownerCookieIssuedAt: MARKED, discordId: null });
            mockCookieStore.get.mockImplementation(jar({
                'tabletop_participant_my-slug': signValue('participant:my-slug', '6'),
                tabletop_user_discord_id: signValue('identity:discord', 'discord-42'),
            }));

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'discord' });

            expect(result).toHaveProperty('error');
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });

        it('refuses a participant cookie signed for another event', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'my-slug' });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, ownerCookieIssuedAt: MARKED, chatId: null });
            mockCookieStore.get.mockImplementation(jar({
                'tabletop_participant_my-slug': signValue('participant:other', '5'),
                tabletop_user_chat_id: signValue('identity:telegram', '999'),
            }));

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toHaveProperty('error');
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });

        it('never overwrites an existing discordUsername from the display-name cookie', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'my-slug' });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, ownerCookieIssuedAt: MARKED, discordId: null, discordUsername: 'RealName' });
            mockCookieStore.get.mockImplementation(jar({
                ...OWNS_5,
                tabletop_user_discord_id: signValue('identity:discord', 'discord-42'),
                tabletop_user_discord_name: 'Spoofed',
            }));

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'discord' });

            expect(result).toEqual({ success: true, message: expect.any(String) });
            expect(mockPrisma.participant.update).toHaveBeenCalledWith({
                where: { id: 5 },
                data: { discordId: 'discord-42' }
            });
        });

        it('links an unmarked legacy row by id without a participant cookie, issues the cookie and marks the row', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'my-slug' });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, chatId: null, ownerCookieIssuedAt: null });
            mockPrisma.participant.updateMany.mockResolvedValue({ count: 1 });
            mockCookieStore.get.mockImplementation(jar({ tabletop_user_chat_id: signValue('identity:telegram', '999') }));

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ success: true, message: expect.any(String) });
            expect(mockPrisma.participant.updateMany).toHaveBeenCalledWith({
                where: { id: 5, ownerCookieIssuedAt: null },
                data: { ownerCookieIssuedAt: expect.any(Date) },
            });
            expect(mockCookieStore.set).toHaveBeenCalledWith(
                'tabletop_participant_my-slug',
                signValue('participant:my-slug', '5'),
                expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
            );
            expect(mockPrisma.participant.update).toHaveBeenCalledWith({
                where: { id: 5 },
                data: { chatId: '999' }
            });
        });

        it('refuses an unmarked legacy row another browser marked first (claim count 0) without the cookie', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'my-slug' });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, chatId: null, ownerCookieIssuedAt: null });
            mockPrisma.participant.updateMany.mockResolvedValue({ count: 0 });
            mockCookieStore.get.mockImplementation(jar({ tabletop_user_chat_id: signValue('identity:telegram', '999') }));

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ error: expect.stringContaining('vote') });
            expect(mockCookieStore.set).not.toHaveBeenCalled();
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });

        it('does not mark a legacy row when the caller has no verified identity to link', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'my-slug' });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, chatId: null, ownerCookieIssuedAt: null });
            mockCookieStore.get.mockImplementation(jar({}));

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ error: expect.stringContaining('Not synced with Telegram') });
            expect(mockPrisma.participant.updateMany).not.toHaveBeenCalled();
            expect(mockCookieStore.set).not.toHaveBeenCalled();
        });

        it('refuses a marked row without the participant cookie and never re-marks it', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'my-slug' });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, chatId: null, ownerCookieIssuedAt: MARKED });
            mockCookieStore.get.mockImplementation(jar({ tabletop_user_chat_id: signValue('identity:telegram', '999') }));

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ error: expect.stringContaining('vote') });
            expect(mockPrisma.participant.updateMany).not.toHaveBeenCalled();
            expect(mockCookieStore.set).not.toHaveBeenCalled();
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });

        it('errors when the event is not found', async () => {
            mockPrisma.event.findUnique.mockResolvedValue(null);

            const result = await linkParticipant({ slug: 'missing-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ error: expect.any(String) });
            expect(mockPrisma.participant.findUnique).not.toHaveBeenCalled();
        });
    });

    describe('unlinkParticipant', () => {
        it('unlinks a Telegram-linked participant, preserving telegramId', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'my-slug' });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, chatId: '999', telegramId: '@chris' });
            mockCookieStore.get.mockImplementation((name: string) =>
                name === 'tabletop_user_chat_id' ? { value: signValue('identity:telegram', '999') } : undefined
            );

            const result = await unlinkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ success: true, message: expect.any(String) });
            expect(mockPrisma.participant.update).toHaveBeenCalledWith({
                where: { id: 5 },
                data: { chatId: null }
            });
        });

        it('unlinks a Discord-linked participant, clearing both id and username', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'my-slug' });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, discordId: 'discord-42', discordUsername: 'ChrisM' });
            mockCookieStore.get.mockImplementation((name: string) =>
                name === 'tabletop_user_discord_id' ? { value: signValue('identity:discord', 'discord-42') } : undefined
            );

            const result = await unlinkParticipant({ slug: 'my-slug', participantId: 5, platform: 'discord' });

            expect(result).toEqual({ success: true, message: expect.any(String) });
            expect(mockPrisma.participant.update).toHaveBeenCalledWith({
                where: { id: 5 },
                data: { discordId: null, discordUsername: null }
            });
        });

        it('refuses to unlink when the identity does not match the caller\'s cookie', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'my-slug' });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, chatId: '111' });
            mockCookieStore.get.mockImplementation((name: string) =>
                name === 'tabletop_user_chat_id' ? { value: signValue('identity:telegram', '999') } : undefined
            );

            const result = await unlinkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ error: expect.stringContaining('not linked') });
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });

        it('refuses to unlink an already-unlinked participant', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'my-slug' });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, chatId: null });
            mockCookieStore.get.mockImplementation((name: string) =>
                name === 'tabletop_user_chat_id' ? { value: signValue('identity:telegram', '999') } : undefined
            );

            const result = await unlinkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ error: expect.stringContaining('not linked') });
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });
    });
});

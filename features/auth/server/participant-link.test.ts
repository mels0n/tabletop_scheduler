import { describe, it, expect, vi, beforeEach } from 'vitest';
import { linkParticipant, unlinkParticipant } from './participant-link';
import { cookies } from 'next/headers';
import prisma from '@/shared/lib/prisma';

vi.mock('@/shared/lib/prisma');

const mockCookies = cookies as unknown as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
    event: { findUnique: ReturnType<typeof vi.fn> },
    participant: { findUnique: ReturnType<typeof vi.fn>, update: ReturnType<typeof vi.fn> }
};

describe('participant-link actions', () => {
    const mockCookieStore = {
        get: vi.fn(),
    };

    beforeEach(() => {
        vi.resetAllMocks();
        (cookies as any).mockReturnValue(mockCookieStore);
    });

    describe('linkParticipant', () => {
        it('links an unclaimed participant to the caller\'s Telegram identity', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1 });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, chatId: null });
            mockCookieStore.get.mockImplementation((name: string) =>
                name === 'tabletop_user_chat_id' ? { value: '999' } : undefined
            );

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ success: true, message: expect.any(String) });
            expect(mockPrisma.participant.update).toHaveBeenCalledWith({
                where: { id: 5 },
                data: { chatId: '999' }
            });
        });

        it('links an unclaimed participant to the caller\'s Discord identity, including username', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1 });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, discordId: null });
            mockCookieStore.get.mockImplementation((name: string) => {
                if (name === 'tabletop_user_discord_id') return { value: 'discord-42' };
                if (name === 'tabletop_user_discord_name') return { value: 'ChrisM' };
                return undefined;
            });

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'discord' });

            expect(result).toEqual({ success: true, message: expect.any(String) });
            expect(mockPrisma.participant.update).toHaveBeenCalledWith({
                where: { id: 5 },
                data: { discordId: 'discord-42', discordUsername: 'ChrisM' }
            });
        });

        it('is idempotent when re-linking to the same Telegram identity', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1 });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, chatId: '999' });
            mockCookieStore.get.mockImplementation((name: string) =>
                name === 'tabletop_user_chat_id' ? { value: '999' } : undefined
            );

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ success: true });
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });

        it('refuses to link a participant already claimed by a different Telegram account', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1 });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, chatId: '111' });
            mockCookieStore.get.mockImplementation((name: string) =>
                name === 'tabletop_user_chat_id' ? { value: '999' } : undefined
            );

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ error: expect.stringContaining('already linked to a different Telegram account') });
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });

        it('refuses to link when the platform cookie is missing', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1 });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, chatId: null });
            mockCookieStore.get.mockReturnValue(undefined);

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ error: expect.stringContaining('Not synced with Telegram') });
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });

        it('refuses to link a participant that belongs to a different event', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1 });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 2, chatId: null });
            mockCookieStore.get.mockImplementation((name: string) =>
                name === 'tabletop_user_chat_id' ? { value: '999' } : undefined
            );

            const result = await linkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ error: expect.any(String) });
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
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1 });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, chatId: '999', telegramId: '@chris' });
            mockCookieStore.get.mockImplementation((name: string) =>
                name === 'tabletop_user_chat_id' ? { value: '999' } : undefined
            );

            const result = await unlinkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ success: true, message: expect.any(String) });
            expect(mockPrisma.participant.update).toHaveBeenCalledWith({
                where: { id: 5 },
                data: { chatId: null }
            });
        });

        it('unlinks a Discord-linked participant, clearing both id and username', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1 });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, discordId: 'discord-42', discordUsername: 'ChrisM' });
            mockCookieStore.get.mockImplementation((name: string) =>
                name === 'tabletop_user_discord_id' ? { value: 'discord-42' } : undefined
            );

            const result = await unlinkParticipant({ slug: 'my-slug', participantId: 5, platform: 'discord' });

            expect(result).toEqual({ success: true, message: expect.any(String) });
            expect(mockPrisma.participant.update).toHaveBeenCalledWith({
                where: { id: 5 },
                data: { discordId: null, discordUsername: null }
            });
        });

        it('refuses to unlink when the identity does not match the caller\'s cookie', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1 });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, chatId: '111' });
            mockCookieStore.get.mockImplementation((name: string) =>
                name === 'tabletop_user_chat_id' ? { value: '999' } : undefined
            );

            const result = await unlinkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ error: expect.stringContaining('not linked') });
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });

        it('refuses to unlink an already-unlinked participant', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ id: 1 });
            mockPrisma.participant.findUnique.mockResolvedValue({ id: 5, eventId: 1, chatId: null });
            mockCookieStore.get.mockImplementation((name: string) =>
                name === 'tabletop_user_chat_id' ? { value: '999' } : undefined
            );

            const result = await unlinkParticipant({ slug: 'my-slug', participantId: 5, platform: 'telegram' });

            expect(result).toEqual({ error: expect.stringContaining('not linked') });
            expect(mockPrisma.participant.update).not.toHaveBeenCalled();
        });
    });
});

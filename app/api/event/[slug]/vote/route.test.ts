import { describe, it, expect, vi } from 'vitest';
import { resolvePassiveChatId } from './route';

describe('resolvePassiveChatId', () => {
    it('matches an existing Participant chatId regardless of @ prefix on either side', async () => {
        const tx = {
            participant: {
                findFirst: vi.fn().mockResolvedValue({ chatId: '111' })
            },
            event: {
                findFirst: vi.fn()
            }
        };

        const result = await resolvePassiveChatId(tx, '@pyaniz');

        expect(result).toBe('111');
        expect(tx.participant.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                telegramId: { in: ['pyaniz', '@pyaniz'] },
                NOT: { chatId: null }
            })
        }));
        // Found via Participant; should never fall back to the Event manager lookup.
        expect(tx.event.findFirst).not.toHaveBeenCalled();
    });

    it('falls back to Event.managerTelegram/managerChatId when no Participant row matches', async () => {
        const tx = {
            participant: {
                findFirst: vi.fn().mockResolvedValue(null)
            },
            event: {
                findFirst: vi.fn().mockResolvedValue({ managerChatId: '171713700' })
            }
        };

        const result = await resolvePassiveChatId(tx, 'mels0n');

        expect(result).toBe('171713700');
        expect(tx.event.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                managerTelegram: { in: ['mels0n', '@mels0n'] },
                NOT: { managerChatId: null }
            })
        }));
    });

    it('returns null when neither a Participant nor an Event manager record matches', async () => {
        const tx = {
            participant: { findFirst: vi.fn().mockResolvedValue(null) },
            event: { findFirst: vi.fn().mockResolvedValue(null) }
        };

        const result = await resolvePassiveChatId(tx, 'nobody');

        expect(result).toBeNull();
    });
});

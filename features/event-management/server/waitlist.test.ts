import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/event-management/server/dashboard-sync', () => ({ syncDashboard: vi.fn() }));
vi.mock('@/features/notifications', () => ({ sendDirectMessage: vi.fn() }));

import prisma from '@/shared/lib/prisma';
import { sendDirectMessage } from '@/features/notifications';
import { syncDashboard } from '@/features/event-management/server/dashboard-sync';
import { processWaitlistPromotion } from './waitlist';

const mockPrisma = prisma as any;
const mockSend = sendDirectMessage as unknown as ReturnType<typeof vi.fn>;

const t = (iso: string) => new Date(iso);
const oneShot = { id: 1, title: 'Game Night', status: 'FINALIZED', maxPlayers: 2, finalizedSlotId: 3 };

const maybeEarly = { id: 10, chatId: 'c10', discordId: null, votes: [{ timeSlotId: 3, preference: 'MAYBE', createdAt: t('2026-01-01T00:00:00Z') }] };
const yesLate = { id: 11, chatId: 'c11', discordId: null, votes: [{ timeSlotId: 3, preference: 'YES', createdAt: t('2026-01-02T00:00:00Z') }] };

describe('processWaitlistPromotion', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockPrisma));
        mockPrisma.event.findUnique.mockResolvedValue(oneShot);
        mockPrisma.event.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.participant.findMany.mockResolvedValue([maybeEarly, yesLate]);
        mockPrisma.participant.updateMany.mockResolvedValue({ count: 1 });
        mockSend.mockResolvedValue({});
    });

    it('promotes the best candidate with a conditional update inside one transaction and a recount', async () => {
        mockPrisma.participant.count.mockResolvedValueOnce(1).mockResolvedValueOnce(2);

        await processWaitlistPromotion(1);

        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        expect(mockPrisma.participant.updateMany).toHaveBeenCalledTimes(1);
        expect(mockPrisma.participant.updateMany).toHaveBeenCalledWith({
            where: { id: 11, eventId: 1, status: 'WAITLIST' },
            data: { status: 'ACCEPTED' },
        });
        expect(mockPrisma.participant.count).toHaveBeenCalledTimes(2);
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend.mock.calls[0][0]).toEqual({ telegramChatId: 'c11', discordUserId: null });
        expect(syncDashboard).toHaveBeenCalledWith(1);
    });

    it('sends nothing when a concurrent run already promoted the candidate', async () => {
        mockPrisma.participant.count.mockResolvedValue(1);
        mockPrisma.participant.updateMany.mockResolvedValue({ count: 0 });

        await processWaitlistPromotion(1);

        expect(mockSend).not.toHaveBeenCalled();
    });

    it('reverts the promotion when the recount shows the event overbooked', async () => {
        mockPrisma.participant.count.mockResolvedValueOnce(1).mockResolvedValueOnce(3);

        await processWaitlistPromotion(1);

        expect(mockPrisma.participant.updateMany).toHaveBeenLastCalledWith({
            where: { id: 11, eventId: 1, status: 'ACCEPTED' },
            data: { status: 'WAITLIST' },
        });
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('does nothing when the event is full', async () => {
        mockPrisma.participant.count.mockResolvedValue(2);

        await processWaitlistPromotion(1);

        expect(mockPrisma.participant.updateMany).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('uses the FinalizedSession slots for campaigns (finalizedSlotId is null)', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ ...oneShot, finalizedSlotId: null });
        mockPrisma.finalizedSession.findMany.mockResolvedValue([{ timeSlotId: 7 }, { timeSlotId: 8 }]);
        mockPrisma.participant.findMany.mockResolvedValue([
            { id: 20, chatId: null, discordId: 'd20', votes: [{ timeSlotId: 8, preference: 'YES', createdAt: t('2026-01-01T00:00:00Z') }] },
        ]);
        mockPrisma.participant.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

        await processWaitlistPromotion(1);

        expect(mockPrisma.finalizedSession.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: 1 } }));
        const where = mockPrisma.participant.findMany.mock.calls[0][0].include.votes.where;
        expect(where).toEqual({ timeSlotId: { in: [7, 8] } });
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend.mock.calls[0][0]).toEqual({ telegramChatId: null, discordUserId: 'd20' });
    });

    describe('If Needed (MAYBE) candidates are seated only below the minimum', () => {
        const event = { ...oneShot, maxPlayers: 6, minPlayers: 4 };
        const maybe = (id: number, day: number) => ({
            id, chatId: `c${id}`, discordId: null,
            votes: [{ timeSlotId: 3, preference: 'MAYBE', createdAt: t(`2026-01-0${day}T00:00:00Z`) }],
        });
        const yes = (id: number, day: number) => ({
            id, chatId: `c${id}`, discordId: null,
            votes: [{ timeSlotId: 3, preference: 'YES', createdAt: t(`2026-01-0${day}T00:00:00Z`) }],
        });
        const promotedIds = () =>
            mockPrisma.participant.updateMany.mock.calls
                .filter((c: any) => c[0].data.status === 'ACCEPTED')
                .map((c: any) => c[0].where.id);

        beforeEach(() => {
            mockPrisma.event.findUnique.mockResolvedValue(event);
        });

        it('Scenario A: leaves an If Needed player on the waitlist when quorum is met and a seat is open', async () => {
            mockPrisma.participant.findMany.mockResolvedValue([maybe(10, 1)]);
            mockPrisma.participant.count.mockResolvedValue(5);

            await processWaitlistPromotion(1);

            expect(mockPrisma.participant.updateMany).not.toHaveBeenCalled();
            expect(mockSend).not.toHaveBeenCalled();
            expect(syncDashboard).not.toHaveBeenCalled();
        });

        it('Scenario C: one seat opens, the Yes voter is promoted and the If Needed voter is not', async () => {
            mockPrisma.participant.findMany.mockResolvedValue([maybe(10, 1), yes(11, 2)]);
            mockPrisma.participant.count.mockResolvedValueOnce(5).mockResolvedValueOnce(6);

            await processWaitlistPromotion(1);

            expect(promotedIds()).toEqual([11]);
            expect(mockSend).toHaveBeenCalledTimes(1);
            expect(mockSend.mock.calls[0][0]).toEqual({ telegramChatId: 'c11', discordUserId: null });
        });

        it('seats an If Needed player when the table is below its minimum, then stops at the minimum', async () => {
            mockPrisma.participant.findMany.mockResolvedValue([maybe(10, 1), maybe(12, 3)]);
            mockPrisma.participant.count.mockResolvedValueOnce(3).mockResolvedValueOnce(4);

            await processWaitlistPromotion(1);

            expect(promotedIds()).toEqual([10]);
            expect(mockSend).toHaveBeenCalledTimes(1);
        });

        it('Yes voters still fill every open seat up to the maximum', async () => {
            mockPrisma.participant.findMany.mockResolvedValue([yes(11, 1), yes(13, 2), yes(14, 3)]);
            mockPrisma.participant.count
                .mockResolvedValueOnce(4)
                .mockResolvedValueOnce(5)
                .mockResolvedValueOnce(6);

            await processWaitlistPromotion(1);

            expect(promotedIds()).toEqual([11, 13]);
        });

        it('seats Yes voters first, then If Needed voters only while still below the minimum', async () => {
            mockPrisma.participant.findMany.mockResolvedValue([maybe(10, 1), maybe(12, 2), yes(11, 3)]);
            mockPrisma.participant.count
                .mockResolvedValueOnce(2)
                .mockResolvedValueOnce(3)
                .mockResolvedValueOnce(4);

            await processWaitlistPromotion(1);

            expect(promotedIds()).toEqual([11, 10]);
        });

        it('never auto-promotes an If Needed player when the event has no minimum', async () => {
            for (const minPlayers of [null, 0]) {
                mockPrisma.participant.updateMany.mockClear();
                mockPrisma.event.findUnique.mockResolvedValue({ ...event, minPlayers });
                mockPrisma.participant.findMany.mockResolvedValue([maybe(10, 1)]);
                mockPrisma.participant.count.mockResolvedValue(0);

                await processWaitlistPromotion(1);

                expect(mockPrisma.participant.updateMany).not.toHaveBeenCalled();
            }
        });

        it('ranks MAYBE above NO: a NO on one campaign session does not hide a later MAYBE on another', async () => {
            mockPrisma.event.findUnique.mockResolvedValue({ ...event, finalizedSlotId: null });
            mockPrisma.finalizedSession.findMany.mockResolvedValue([{ timeSlotId: 7 }, { timeSlotId: 8 }]);
            mockPrisma.participant.findMany.mockResolvedValue([{
                id: 16, chatId: 'c16', discordId: null,
                votes: [
                    { timeSlotId: 7, preference: 'NO', createdAt: t('2026-01-01T00:00:00Z') },
                    { timeSlotId: 8, preference: 'MAYBE', createdAt: t('2026-01-02T00:00:00Z') },
                ],
            }]);
            mockPrisma.participant.count.mockResolvedValueOnce(2).mockResolvedValueOnce(3);

            await processWaitlistPromotion(1);

            expect(promotedIds()).toEqual([16]);
        });

        it('ranks an earlier NO voter after a later MAYBE voter', async () => {
            const no = { id: 17, chatId: 'c17', discordId: null, votes: [{ timeSlotId: 3, preference: 'NO', createdAt: t('2026-01-01T00:00:00Z') }] };
            mockPrisma.participant.findMany.mockResolvedValue([no, maybe(18, 2)]);
            mockPrisma.participant.count.mockResolvedValueOnce(3).mockResolvedValueOnce(4);

            await processWaitlistPromotion(1);

            expect(promotedIds()).toEqual([18]);
        });

        it('never promotes a candidate with no vote on the finalized slot', async () => {
            mockPrisma.participant.findMany.mockResolvedValue([{ id: 15, chatId: 'c15', discordId: null, votes: [] }]);
            mockPrisma.participant.count.mockResolvedValue(1);

            await processWaitlistPromotion(1);

            expect(mockPrisma.participant.updateMany).not.toHaveBeenCalled();
            expect(mockSend).not.toHaveBeenCalled();
        });
    });

    it('never throws to the caller', async () => {
        mockPrisma.event.findUnique.mockRejectedValue(new Error('db down'));
        await expect(processWaitlistPromotion(1)).resolves.toBeUndefined();
    });
});

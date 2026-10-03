import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/auth/server/verify', () => ({ verifyEventAdmin: vi.fn() }));

import prisma from '@/shared/lib/prisma';
import { verifyEventAdmin } from '@/features/auth/server/verify';
import { updateReminderSettings } from './actions';

const mockPrisma = prisma as any;

describe('updateReminderSettings', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        (verifyEventAdmin as any).mockResolvedValue(true);
        mockPrisma.event.findUnique.mockResolvedValue({ id: 3 });
    });

    it('stores valid weekdays as csv', async () => {
        expect(await updateReminderSettings('s', true, '18:30', [1, 3, 5])).toEqual({ success: true });
        expect(mockPrisma.event.update).toHaveBeenCalledWith({
            where: { id: 3 },
            data: { reminderEnabled: true, reminderTime: '18:30', reminderDays: '1,3,5' },
        });
    });

    it('accepts all seven days and an empty list', async () => {
        expect(await updateReminderSettings('s', true, '09:00', [0, 1, 2, 3, 4, 5, 6])).toEqual({ success: true });
        expect(await updateReminderSettings('s', false, '09:00', [])).toEqual({ success: true });
    });

    it.each([
        ['a day above 6', [7]],
        ['a negative day', [-1]],
        ['a fractional day', [1.5]],
        ['duplicate days', [1, 1]],
        ['more than seven days', [0, 1, 2, 3, 4, 5, 6, 0]],
        ['a string day', ['1'] as unknown as number[]],
        ['a non-array', '1,2' as unknown as number[]],
    ])('rejects %s without writing', async (_label, days) => {
        expect(await updateReminderSettings('s', true, '18:30', days)).toMatchObject({ success: false });
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });

    it('rejects a bad time when enabled and a non-boolean enabled flag', async () => {
        expect(await updateReminderSettings('s', true, '25:00', [1])).toMatchObject({ success: false });
        expect(await updateReminderSettings('s', 'yes' as any, '18:00', [1])).toMatchObject({ success: false });
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });

    it('rejects non-admins', async () => {
        (verifyEventAdmin as any).mockResolvedValue(false);
        expect(await updateReminderSettings('s', true, '18:30', [1])).toEqual({ success: false, error: 'Unauthorized' });
    });
});

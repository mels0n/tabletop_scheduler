import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/lib/prisma');
vi.mock('@/features/auth/server/verify', () => ({ verifyEventAdmin: vi.fn() }));

import prisma from '@/shared/lib/prisma';
import { verifyEventAdmin } from '@/features/auth/server/verify';
import { updateSessionReminderSettings } from './actions';
import { SESSION_REMINDER_LEADS } from '@/features/notifications/model/leads';

const mockPrisma = prisma as any;

describe('updateSessionReminderSettings', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        (verifyEventAdmin as any).mockResolvedValue(true);
        mockPrisma.event.findUnique.mockResolvedValue({ id: 3 });
    });

    it.each(SESSION_REMINDER_LEADS)('accepts the shared lead %i', async (lead) => {
        expect(await updateSessionReminderSettings('s', true, lead)).toEqual({ success: true });
        expect(mockPrisma.event.update).toHaveBeenCalledWith({
            where: { id: 3 },
            data: { sessionReminderEnabled: true, sessionReminderLeadMinutes: lead },
        });
    });

    it.each([60, 0, -120, 121, Number.NaN])('rejects lead %s', async (lead) => {
        expect(await updateSessionReminderSettings('s', true, lead)).toEqual({ success: false, error: 'Invalid lead time' });
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });

    it('rejects a non-boolean enabled flag', async () => {
        expect(await updateSessionReminderSettings('s', 'yes' as any, 120)).toMatchObject({ success: false });
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });

    it('rejects non-admins', async () => {
        (verifyEventAdmin as any).mockResolvedValue(false);
        expect(await updateSessionReminderSettings('s', true, 120)).toEqual({ success: false, error: 'Unauthorized' });
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });
});

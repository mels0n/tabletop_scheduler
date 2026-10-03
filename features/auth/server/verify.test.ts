import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cookies } from 'next/headers';
import prisma from '@/shared/lib/prisma';
import { hashToken } from '@/shared/lib/token';
import { signValue } from '@/shared/lib/session';
import { ForbiddenError } from '@/shared/errors';
import { verifyEventAdmin, requireEventAdmin, isAdminToken } from './verify';

vi.mock('@/shared/lib/prisma');

const mockPrisma = prisma as unknown as { event: { findUnique: ReturnType<typeof vi.fn> } };

const RAW_TOKEN = 'raw-admin-token';
const MANAGER_DISCORD = '987654321098765432';
const MANAGER_CHAT = '555000111';

function useCookies(values: Record<string, string>) {
    (cookies as any).mockResolvedValue({
        get: (name: string) => (name in values ? { name, value: values[name] } : undefined),
    });
}

describe('verifyEventAdmin', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockPrisma.event.findUnique.mockResolvedValue({
            adminToken: hashToken(RAW_TOKEN),
            managerChatId: MANAGER_CHAT,
            managerDiscordId: MANAGER_DISCORD,
        });
    });

    it('returns false with no cookies and does not query the database', async () => {
        useCookies({});
        expect(await verifyEventAdmin('my-slug')).toBe(false);
        expect(mockPrisma.event.findUnique).not.toHaveBeenCalled();
    });

    it('rejects an unsigned discord identity cookie equal to the manager ID', async () => {
        useCookies({ tabletop_user_discord_id: MANAGER_DISCORD });
        expect(await verifyEventAdmin('my-slug')).toBe(false);
    });

    it('accepts a signed discord identity cookie equal to the manager ID', async () => {
        useCookies({ tabletop_user_discord_id: signValue('identity:discord', MANAGER_DISCORD) });
        expect(await verifyEventAdmin('my-slug')).toBe(true);
    });

    it('rejects an unsigned telegram identity cookie and accepts a signed one', async () => {
        useCookies({ tabletop_user_chat_id: MANAGER_CHAT });
        expect(await verifyEventAdmin('my-slug')).toBe(false);
        useCookies({ tabletop_user_chat_id: signValue('identity:telegram', MANAGER_CHAT) });
        expect(await verifyEventAdmin('my-slug')).toBe(true);
    });

    it('rejects a signed identity that is not the manager', async () => {
        useCookies({ tabletop_user_discord_id: signValue('identity:discord', '111111111111111111') });
        expect(await verifyEventAdmin('my-slug')).toBe(false);
    });

    it('rejects an admin cookie equal to the stored hash', async () => {
        useCookies({ 'tabletop_admin_my-slug': hashToken(RAW_TOKEN) });
        expect(await verifyEventAdmin('my-slug')).toBe(false);
    });

    it('accepts the raw admin token', async () => {
        useCookies({ 'tabletop_admin_my-slug': RAW_TOKEN });
        expect(await verifyEventAdmin('my-slug')).toBe(true);
    });

    it('rejects a legacy plaintext adminToken row (no plaintext compare)', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ adminToken: RAW_TOKEN, managerChatId: null, managerDiscordId: null });
        useCookies({ 'tabletop_admin_my-slug': RAW_TOKEN });
        expect(await verifyEventAdmin('my-slug')).toBe(false);
    });

    it('returns false when the event does not exist', async () => {
        mockPrisma.event.findUnique.mockResolvedValue(null);
        useCookies({ 'tabletop_admin_my-slug': RAW_TOKEN });
        expect(await verifyEventAdmin('my-slug')).toBe(false);
    });

    it('does not accept another event\'s admin cookie', async () => {
        useCookies({ 'tabletop_admin_other-slug': RAW_TOKEN });
        expect(await verifyEventAdmin('my-slug')).toBe(false);
    });
});

describe('requireEventAdmin', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockPrisma.event.findUnique.mockResolvedValue({
            adminToken: hashToken(RAW_TOKEN),
            managerChatId: null,
            managerDiscordId: MANAGER_DISCORD,
        });
    });

    it('throws ForbiddenError when not admin', async () => {
        useCookies({ tabletop_user_discord_id: MANAGER_DISCORD });
        await expect(requireEventAdmin('my-slug')).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('resolves when admin', async () => {
        useCookies({ tabletop_user_discord_id: signValue('identity:discord', MANAGER_DISCORD) });
        await expect(requireEventAdmin('my-slug')).resolves.toBeUndefined();
    });
});

describe('isAdminToken', () => {
    it('matches only the hash of the raw token', () => {
        const stored = hashToken(RAW_TOKEN);
        expect(isAdminToken(RAW_TOKEN, stored)).toBe(true);
        expect(isAdminToken(stored, stored)).toBe(false);
        expect(isAdminToken('wrong', stored)).toBe(false);
        expect(isAdminToken(RAW_TOKEN, null)).toBe(false);
        expect(isAdminToken(RAW_TOKEN, RAW_TOKEN)).toBe(false);
    });
});

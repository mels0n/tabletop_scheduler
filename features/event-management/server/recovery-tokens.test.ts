import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { generateManagerMagicLink, generateShortRecoveryToken, getConnectCommand } from './recovery-tokens';
import prisma from '@/shared/lib/prisma';
import { verifyEventAdmin } from '@/features/auth/server/verify';
import { ForbiddenError } from '@/shared/errors';
import { connectCodeFor } from '@/features/telegram/model/connect-code';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/prisma');
// requireEventAdmin keeps its real contract on top of the mocked verifyEventAdmin.
vi.mock('@/features/auth/server/verify', async () => {
    const { ForbiddenError } = await import('@/shared/errors');
    const verifyEventAdmin = vi.fn();
    return {
        verifyEventAdmin,
        requireEventAdmin: async (slug: string) => {
            if (!(await verifyEventAdmin(slug))) throw new ForbiddenError();
        },
    };
});

const mockPrisma = prisma as unknown as {
    event: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
};
const mockAdmin = verifyEventAdmin as unknown as ReturnType<typeof vi.fn>;

describe('recovery token minting requires admin', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockPrisma.event.update.mockResolvedValue({});
        mockPrisma.event.findUnique.mockResolvedValue({ slug: 'abc', adminToken: 'e'.repeat(64) });
    });

    it('generateShortRecoveryToken throws ForbiddenError for a non-admin', async () => {
        mockAdmin.mockResolvedValue(false);
        await expect(generateShortRecoveryToken('abc')).rejects.toBeInstanceOf(ForbiddenError);
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });

    it('generateManagerMagicLink throws ForbiddenError for a non-admin', async () => {
        mockAdmin.mockResolvedValue(false);
        await expect(generateManagerMagicLink('abc')).rejects.toBeInstanceOf(ForbiddenError);
        expect(mockPrisma.event.update).not.toHaveBeenCalled();
    });

    it('getConnectCommand derives the code from the stored admin token hash, current binding and nonce', async () => {
        mockPrisma.event.findUnique.mockResolvedValue({ id: 1, slug: 'abc', adminToken: 'e'.repeat(64), telegramChatId: '-1001', telegramConnectNonce: 'n1' });
        expect(await getConnectCommand('abc')).toBe(`/connect abc ${connectCodeFor('abc', 'e'.repeat(64), '-1001', 'n1')}`);
        expect(mockPrisma.event.findUnique).toHaveBeenCalledWith(expect.objectContaining({
            select: expect.objectContaining({ adminToken: true, telegramChatId: true, telegramConnectNonce: true }),
        }));
        expect(mockPrisma.event.updateMany).not.toHaveBeenCalled();
    });

    it('getConnectCommand persists a nonce first when the event has none', async () => {
        let stored: string | null = null;
        mockPrisma.event.findUnique.mockImplementation(async () => ({ id: 1, slug: 'abc', adminToken: 'e'.repeat(64), telegramChatId: null, telegramConnectNonce: stored }));
        mockPrisma.event.updateMany.mockImplementation(async ({ data }: { data: { telegramConnectNonce: string } }) => {
            stored = data.telegramConnectNonce;
            return { count: 1 };
        });

        const command = await getConnectCommand('abc');

        expect(mockPrisma.event.updateMany).toHaveBeenCalledWith({
            where: { id: 1, telegramConnectNonce: null },
            data: { telegramConnectNonce: expect.stringMatching(/^[0-9a-f]{32}$/) },
        });
        expect(stored).toBeTruthy();
        expect(command).toBe(`/connect abc ${connectCodeFor('abc', 'e'.repeat(64), null, stored)}`);
    });
});

const ROOT = path.resolve(__dirname, '../../..');
const SCAN = ['app', 'features', 'components', 'shared', 'lib', 'hooks'];
const MINTERS = /\b(generateManagerMagicLink|generateShortRecoveryToken)\b/;

function sourceFiles(dir: string): string[] {
    let out: string[] = [];
    let entries: string[];
    try {
        entries = readdirSync(dir);
    } catch {
        return out;
    }
    for (const name of entries) {
        if (name === 'node_modules' || name.startsWith('.')) continue;
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) out = out.concat(sourceFiles(full));
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
    }
    return out;
}

/** True when the file's first statement is the "use server" directive. */
function isServerActionModule(src: string): boolean {
    const firstStatement = src
        .replace(/^(\s*(\/\/[^\r\n]*|\/\*[\s\S]*?\*\/))*\s*/, '');
    return /^["']use server["']/.test(firstStatement);
}

function exportsMinter(src: string): boolean {
    const declared = /export\s+(async\s+)?(function\*?|const|let|var)\s+(generateManagerMagicLink|generateShortRecoveryToken)\b/;
    const listed = [...src.matchAll(/export\s*\{([^}]*)\}/g)].some((m) => MINTERS.test(m[1]));
    return declared.test(src) || listed;
}

describe('token minting never ships as a server action', () => {
    it('no "use server" module exports generateManagerMagicLink or generateShortRecoveryToken', () => {
        const offenders = SCAN.flatMap((d) => sourceFiles(path.join(ROOT, d)))
            .filter((file) => {
                const src = readFileSync(file, 'utf8');
                return isServerActionModule(src) && exportsMinter(src);
            })
            .map((file) => path.relative(ROOT, file));
        expect(offenders).toEqual([]);
    });

    it('the minting module is marked server-only and is not a server action module', () => {
        const src = readFileSync(path.join(__dirname, 'recovery-tokens.ts'), 'utf8');
        expect(src).toMatch(/^import ["']server-only["'];/m);
        expect(isServerActionModule(src)).toBe(false);
    });

    it('the scan itself detects a server action module that exports a minter', () => {
        expect(isServerActionModule('"use server";\nexport async function generateShortRecoveryToken() {}')).toBe(true);
        expect(exportsMinter('"use server";\nexport async function generateShortRecoveryToken() {}')).toBe(true);
        expect(exportsMinter('export { generateManagerMagicLink as x };')).toBe(true);
    });
});

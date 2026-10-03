import { describe, it, expect, afterEach, vi } from 'vitest';
import Logger from './logger';
import { resetServerConfigForTests } from '@/shared/config/server';
import { stubConfigEnv } from '@/shared/config/test-env';

function capture(method: 'debug' | 'info' | 'warn' | 'error') {
    const lines: string[] = [];
    vi.spyOn(console, method).mockImplementation((line: unknown) => {
        lines.push(String(line));
    });
    return lines;
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resetServerConfigForTests();
});

describe('Logger', () => {
    it('emits exactly one JSON object per line with ts, level, ctx, msg and data', () => {
        stubConfigEnv({});
        resetServerConfigForTests();
        const lines = capture('info');

        Logger.get('Auth').info('Signed in', { userId: 7 });

        expect(lines).toHaveLength(1);
        expect(lines[0]).not.toContain('\n');
        const entry = JSON.parse(lines[0]);
        expect(entry).toMatchObject({ level: 'info', ctx: 'Auth', msg: 'Signed in', userId: 7 });
        expect(new Date(entry.ts).toISOString()).toBe(entry.ts);
    });

    it('serialises errors with name, message and stack on a single line', () => {
        stubConfigEnv({});
        resetServerConfigForTests();
        const lines = capture('error');

        Logger.get('Db').error('Query failed', new Error('boom'));
        Logger.get('Db').error('Wrapped', { error: new TypeError('bad'), slug: 'x' });

        expect(lines).toHaveLength(2);
        const first = JSON.parse(lines[0]);
        expect(first.error).toMatchObject({ name: 'Error', message: 'boom' });
        expect(typeof first.error.stack).toBe('string');
        const second = JSON.parse(lines[1]);
        expect(second.error).toMatchObject({ name: 'TypeError', message: 'bad' });
        expect(second.slug).toBe('x');
    });

    it('survives circular data', () => {
        stubConfigEnv({});
        resetServerConfigForTests();
        const lines = capture('warn');
        const circular: Record<string, unknown> = { a: 1 };
        circular.self = circular;

        Logger.get('X').warn('loop', circular);

        expect(lines).toHaveLength(1);
        const entry = JSON.parse(lines[0]);
        expect(entry.msg).toBe('loop');
    });

    it('does not let data overwrite the reserved fields', () => {
        stubConfigEnv({});
        resetServerConfigForTests();
        const lines = capture('info');

        Logger.get('X').info('real', { msg: 'fake', level: 'error', ctx: 'other' });

        const entry = JSON.parse(lines[0]);
        expect(entry).toMatchObject({ msg: 'real', level: 'info', ctx: 'X' });
    });

    it('filters by the configured level', () => {
        stubConfigEnv({ LOG_LEVEL: 'warn' });
        resetServerConfigForTests();
        const info = capture('info');
        const warn = capture('warn');

        const log = Logger.get('X');
        log.info('hidden');
        log.warn('shown');

        expect(info).toHaveLength(0);
        expect(warn).toHaveLength(1);
    });

    it('still logs at info when the config is invalid', () => {
        stubConfigEnv({ LOG_LEVEL: 'loud' });
        resetServerConfigForTests();
        const lines = capture('info');

        Logger.get('X').info('still here');

        expect(lines).toHaveLength(1);
    });

    it('withRequestId returns a child logger that tags every line', () => {
        stubConfigEnv({});
        resetServerConfigForTests();
        const lines = capture('info');

        const base = Logger.get('Api');
        const child = base.withRequestId('req-123');
        child.info('handled');
        base.info('untagged');

        expect(JSON.parse(lines[0])).toMatchObject({ ctx: 'Api', requestId: 'req-123', msg: 'handled' });
        expect(JSON.parse(lines[1]).requestId).toBeUndefined();
    });
});

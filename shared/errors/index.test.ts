import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import {
    AppError,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    ConfigError,
    toResponse,
} from './index';
import Logger from '@/shared/lib/logger';

function fakeLog() {
    const log = Logger.get('Test');
    vi.spyOn(log, 'error').mockImplementation(() => {});
    vi.spyOn(log, 'warn').mockImplementation(() => {});
    return log;
}

describe('AppError subclasses', () => {
    it.each([
        [ValidationError, 400, 'validation'],
        [UnauthorizedError, 401, 'unauthorized'],
        [ForbiddenError, 403, 'forbidden'],
        [NotFoundError, 404, 'not_found'],
        [ConflictError, 409, 'conflict'],
        [RateLimitError, 429, 'rate_limited'],
        [ConfigError, 500, 'config'],
    ] as const)('%o carries status %i and code %s', (Cls, status, code) => {
        const err = new Cls('boom');
        expect(err).toBeInstanceOf(AppError);
        expect(err).toBeInstanceOf(Error);
        expect(err.status).toBe(status);
        expect(err.code).toBe(code);
        expect(err.message).toBe('boom');
        expect(err.name).toBe(Cls.name);
    });

    it('subclasses have default messages', () => {
        expect(new NotFoundError().message).toBe('Not found');
        expect(new UnauthorizedError().message).toBe('Unauthorized');
    });
});

describe('toResponse', () => {
    it('maps an AppError to its status with { error, code }', async () => {
        const res = toResponse(new ForbiddenError('Not your event'), fakeLog());
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: 'Not your event', code: 'forbidden' });
    });

    it.each([
        [new ValidationError('Bad'), 400],
        [new UnauthorizedError(), 401],
        [new NotFoundError(), 404],
        [new ConflictError(), 409],
        [new RateLimitError(), 429],
    ])('maps %o to %i', (err, status) => {
        expect(toResponse(err, fakeLog()).status).toBe(status);
    });

    it('logs a 5xx AppError and hides its message from the client', async () => {
        const log = fakeLog();
        const res = toResponse(new ConfigError('SESSION_SECRET is required'), log);
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: 'Internal error', code: 'config' });
        expect(log.error).toHaveBeenCalled();
    });

    it('maps a ZodError to 400 with issues', async () => {
        const parsed = z.object({ name: z.string() }).safeParse({ name: 1 });
        expect(parsed.success).toBe(false);
        const res = toResponse(parsed.error, fakeLog());
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Invalid request');
        expect(body.code).toBe('validation');
        expect(Array.isArray(body.issues)).toBe(true);
        expect(body.issues[0].path).toEqual(['name']);
    });

    it('maps Prisma P2025 to 404', async () => {
        const err = new Prisma.PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '5.22.0' });
        const res = toResponse(err, fakeLog());
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'Not found', code: 'not_found' });
    });

    it('maps Prisma P2002 to 409', async () => {
        const err = new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '5.22.0' });
        const res = toResponse(err, fakeLog());
        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({ error: 'Conflict', code: 'conflict' });
    });

    it('maps anything else to 500 without leaking the message, and logs it', async () => {
        const log = fakeLog();
        const res = toResponse(new Error('db password is hunter2'), log);
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: 'Internal error' });
        expect(log.error).toHaveBeenCalledTimes(1);
    });

    it('works without an explicit logger', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(toResponse('a thrown string').status).toBe(500);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});

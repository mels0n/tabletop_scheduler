import { vi } from 'vitest';

export const prisma = {
    event: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
    },
    participant: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
        delete: vi.fn(),
    },
    vote: {
        deleteMany: vi.fn(),
        findMany: vi.fn(),
        createMany: vi.fn(),
    },
    timeSlot: {
        deleteMany: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
    },
    webhookEvent: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
    },
    loginToken: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
    },
    finalizedSession: {
        findMany: vi.fn(),
        createMany: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
    },
    donation: {
        findMany: vi.fn(),
        upsert: vi.fn(),
    },
    dmPreference: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
    },
    // Supports both forms: interactive (callback) and batch (array of pending queries).
    $transaction: vi.fn((arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma))),
};

export default prisma;

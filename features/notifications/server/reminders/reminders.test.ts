import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock, broadcastToEvent, logWarn } = vi.hoisted(() => ({
    prismaMock: {
        event: { findMany: vi.fn(), updateMany: vi.fn() },
        timeSlot: { updateMany: vi.fn(), findUnique: vi.fn() },
    },
    broadcastToEvent: vi.fn(),
    logWarn: vi.fn(),
}));

vi.mock("@/shared/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }));
vi.mock("../deliver", () => ({
    broadcastToEvent,
    isDelivered: (r: { telegram: { status: string }; discord: { status: string } }) =>
        r.telegram.status === "sent" || r.discord.status === "sent",
}));
vi.mock("@/shared/lib/logger", () => {
    const logger = { debug: vi.fn(), info: vi.fn(), warn: logWarn, error: vi.fn() };
    return { default: { get: () => logger } };
});

import { runReminders } from "./index";
import { resetDeadChannelsForTests } from "./types";

const sent = { status: "sent", messageId: "1" } as const;
const notLinked = { status: "skipped", reason: "not_linked" } as const;
const notConfigured = { status: "skipped", reason: "not_configured" } as const;
const failed = { status: "failed", error: "boom" } as const;

const NOW = new Date("2026-10-07T10:05:00Z"); // Wednesday

function baseEvent(overrides: Record<string, unknown> = {}) {
    return {
        id: 1,
        slug: "game-night",
        title: "Game Night",
        timezone: "UTC",
        location: null,
        eventType: "ONE_SHOT",
        telegramChatId: null,
        discordChannelId: "chan-1",
        reminderTime: "10:00",
        reminderDays: "0,1,2,3,4,5,6",
        lastReminderSent: null,
        finalizedSlotId: null,
        finalizedSessions: [],
        timeSlots: [],
        sessionReminderLeadMinutes: 120,
        ...overrides,
    };
}

type FindManyArgs = { where: { status: unknown } };

function votingEvents(...events: ReturnType<typeof baseEvent>[]) {
    prismaMock.event.findMany.mockImplementation(async (args: FindManyArgs) =>
        typeof args.where.status === "object" ? events : []
    );
}

function sessionEvents(...events: ReturnType<typeof baseEvent>[]) {
    prismaMock.event.findMany.mockImplementation(async (args: FindManyArgs) =>
        args.where.status === "FINALIZED" ? events : []
    );
}

/** Today's 10:00 UTC target: the claim only wins if nothing was sent at or after it. */
const TARGET = new Date("2026-10-07T10:00:00Z");
const votingClaim = (id: number, now = NOW) => ({
    where: { id, OR: [{ lastReminderSent: null }, { lastReminderSent: { lt: TARGET } }] },
    data: { lastReminderSent: now },
});
const slotClaim = (id: number, now = NOW) => ({
    where: { id, sessionReminderSentAt: null },
    data: { sessionReminderSentAt: now },
});

describe("runReminders: voting", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        resetDeadChannelsForTests();
        prismaMock.event.findMany.mockResolvedValue([]);
        prismaMock.event.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.timeSlot.updateMany.mockResolvedValue({ count: 1 });
    });

    it("stops voting reminders once quorum is reached, not once the manager is notified", async () => {
        await runReminders(NOW);
        const where = prismaMock.event.findMany.mock.calls.find(([a]) => typeof a.where.status === "object")![0].where;
        expect(where.quorumReachedAt).toBeNull();
        expect(where).not.toHaveProperty("quorumViableNotified");
    });

    it("only nudges events with a proposed time still ahead", async () => {
        await runReminders(NOW);
        const where = prismaMock.event.findMany.mock.calls.find(([a]) => typeof a.where.status === "object")![0].where;
        expect(where.timeSlots).toEqual({ some: { startTime: { gt: NOW } } });
    });

    it("never claims when building the message throws, so the reminder is not lost", async () => {
        const { stubConfigEnv } = await import("@/shared/config/test-env");
        const { resetServerConfigForTests } = await import("@/shared/config/server");
        stubConfigEnv({});
        resetServerConfigForTests();
        try {
            votingEvents(baseEvent());

            const result = await runReminders(NOW);

            expect(prismaMock.event.updateMany).not.toHaveBeenCalled();
            expect(broadcastToEvent).not.toHaveBeenCalled();
            expect(result.voting).toEqual({ sent: 0, failed: 1 });
        } finally {
            vi.unstubAllEnvs();
            resetServerConfigForTests();
        }
    });

    it("claims first, then sends to a Discord-only event", async () => {
        votingEvents(baseEvent());
        broadcastToEvent.mockResolvedValue({ telegram: notLinked, discord: sent });

        const result = await runReminders(NOW);

        expect(prismaMock.event.updateMany).toHaveBeenCalledTimes(1);
        expect(prismaMock.event.updateMany).toHaveBeenCalledWith(votingClaim(1));
        expect(prismaMock.event.updateMany.mock.invocationCallOrder[0])
            .toBeLessThan(broadcastToEvent.mock.invocationCallOrder[0]);
        expect(broadcastToEvent).toHaveBeenCalledTimes(1);
        expect(broadcastToEvent.mock.calls[0][0].telegramChatId).toBeNull();
        expect(result).toEqual({ ok: true, voting: { sent: 1, failed: 0 }, session: { sent: 0, failed: 0 } });
    });

    it("still sends exactly once when the run lands 3 hours after the target", async () => {
        const late = new Date("2026-10-07T13:00:00Z");
        votingEvents(baseEvent());
        broadcastToEvent.mockResolvedValue({ telegram: notLinked, discord: sent });

        const result = await runReminders(late);

        expect(broadcastToEvent).toHaveBeenCalledTimes(1);
        expect(prismaMock.event.updateMany).toHaveBeenCalledWith(votingClaim(1, late));
        expect(result.voting).toEqual({ sent: 1, failed: 0 });
    });

    it("sends nothing when a concurrent run already holds the claim", async () => {
        votingEvents(baseEvent());
        prismaMock.event.updateMany.mockResolvedValue({ count: 0 });

        const result = await runReminders(NOW);

        expect(broadcastToEvent).not.toHaveBeenCalled();
        expect(result.voting).toEqual({ sent: 0, failed: 0 });
    });

    it("releases the claim when every platform failed", async () => {
        const previous = new Date("2026-10-05T10:00:00Z");
        votingEvents(baseEvent({ telegramChatId: "tg-1", lastReminderSent: previous }));
        broadcastToEvent.mockResolvedValue({ telegram: failed, discord: failed });

        const result = await runReminders(NOW);

        expect(prismaMock.event.updateMany).toHaveBeenLastCalledWith({
            where: { id: 1, lastReminderSent: NOW },
            data: { lastReminderSent: previous },
        });
        expect(result.voting).toEqual({ sent: 0, failed: 1 });
    });

    it("counts partial delivery as sent and keeps the claim", async () => {
        votingEvents(baseEvent({ telegramChatId: "tg-1" }));
        broadcastToEvent.mockResolvedValue({ telegram: failed, discord: sent });

        const result = await runReminders(NOW);

        expect(prismaMock.event.updateMany).toHaveBeenCalledTimes(1);
        expect(result.voting).toEqual({ sent: 1, failed: 0 });
    });

    it("does not claim or send when nothing is linked", async () => {
        votingEvents(baseEvent({ discordChannelId: null }));

        const result = await runReminders(NOW);

        expect(prismaMock.event.updateMany).not.toHaveBeenCalled();
        expect(broadcastToEvent).not.toHaveBeenCalled();
        expect(result.voting).toEqual({ sent: 0, failed: 0 });
    });

    it("treats a bot missing on every linked platform as nothing to do: no warning, claim released", async () => {
        votingEvents(baseEvent({ telegramChatId: "tg-1" }));
        broadcastToEvent.mockResolvedValue({ telegram: notConfigured, discord: notConfigured });

        const result = await runReminders(NOW);

        expect(result.voting).toEqual({ sent: 0, failed: 0 });
        expect(logWarn).not.toHaveBeenCalled();
        expect(prismaMock.event.updateMany).toHaveBeenLastCalledWith({
            where: { id: 1, lastReminderSent: NOW },
            data: { lastReminderSent: null },
        });
    });

    it("marks a channel dead on a permanent error, warns once, and skips it next run", async () => {
        votingEvents(baseEvent());
        broadcastToEvent.mockResolvedValue({ telegram: notLinked, discord: { status: "failed", error: "10003 Unknown Channel" } });

        await runReminders(NOW);
        expect(broadcastToEvent).toHaveBeenCalledTimes(1);
        expect(logWarn.mock.calls.filter(([m]) => String(m).includes("unreachable"))).toHaveLength(1);

        broadcastToEvent.mockClear();
        prismaMock.event.updateMany.mockClear();
        const tomorrow = new Date("2026-10-08T10:05:00Z");
        const result = await runReminders(tomorrow);

        expect(broadcastToEvent).not.toHaveBeenCalled();
        expect(prismaMock.event.updateMany).not.toHaveBeenCalled();
        expect(result.voting).toEqual({ sent: 0, failed: 0 });
        expect(logWarn.mock.calls.filter(([m]) => String(m).includes("unreachable"))).toHaveLength(1);
    });

    it("keeps posting to the healthy platform when the other channel is dead", async () => {
        votingEvents(baseEvent({ telegramChatId: "tg-1" }));
        broadcastToEvent.mockResolvedValueOnce({ telegram: { status: "failed", error: "Forbidden: bot was kicked from the group chat" }, discord: sent });
        await runReminders(NOW);

        broadcastToEvent.mockResolvedValueOnce({ telegram: notLinked, discord: sent });
        await runReminders(new Date("2026-10-08T10:05:00Z"));

        expect(broadcastToEvent.mock.calls[1][0]).toEqual({ telegramChatId: null, discordChannelId: "chan-1" });
    });

    it("isolates a failing event from the rest", async () => {
        votingEvents(baseEvent({ id: 1, slug: "a" }), baseEvent({ id: 2, slug: "b" }));
        broadcastToEvent
            .mockRejectedValueOnce(new Error("kaboom"))
            .mockResolvedValueOnce({ telegram: notLinked, discord: sent });

        const result = await runReminders(NOW);

        expect(result.voting).toEqual({ sent: 1, failed: 1 });
        expect(prismaMock.event.updateMany).toHaveBeenCalledWith(votingClaim(2));
    });
});

describe("runReminders: session", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        resetDeadChannelsForTests();
        prismaMock.event.findMany.mockResolvedValue([]);
        prismaMock.event.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.timeSlot.updateMany.mockResolvedValue({ count: 1 });
    });

    it("queries only events with an unsent future slot and loads slots in the same query", async () => {
        await runReminders(NOW);
        const args = prismaMock.event.findMany.mock.calls.find(([a]) => a.where.status === "FINALIZED")![0];
        expect(args.where.timeSlots).toEqual({ some: { startTime: { gt: NOW }, sessionReminderSentAt: null } });
        expect(args.select.timeSlots.where).toMatchObject({ startTime: { gt: NOW }, sessionReminderSentAt: null });
        expect(prismaMock.timeSlot.findUnique).not.toHaveBeenCalled();
    });

    it("claims the finalized slot first, then sends for a one-shot event", async () => {
        const start = new Date("2026-10-07T11:30:00Z");
        sessionEvents(baseEvent({
            finalizedSlotId: 7,
            location: "The Dragon's Den",
            timeSlots: [{ id: 6, startTime: start }, { id: 7, startTime: start }],
        }));
        broadcastToEvent.mockResolvedValue({ telegram: notLinked, discord: sent });

        const result = await runReminders(NOW);

        expect(prismaMock.timeSlot.updateMany).toHaveBeenCalledTimes(1);
        expect(prismaMock.timeSlot.updateMany).toHaveBeenCalledWith(slotClaim(7));
        expect(prismaMock.timeSlot.updateMany.mock.invocationCallOrder[0])
            .toBeLessThan(broadcastToEvent.mock.invocationCallOrder[0]);
        const html = broadcastToEvent.mock.calls[0][1].html as string;
        expect(html).toContain("Game Night");
        expect(html).toContain("The Dragon's Den");
        expect(html).toContain("/e/game-night");
        expect(result.session).toEqual({ sent: 1, failed: 0 });
    });

    it("sends for the due campaign session only", async () => {
        sessionEvents(baseEvent({
            eventType: "CAMPAIGN",
            finalizedSessions: [{ timeSlotId: 11 }, { timeSlotId: 12 }],
            timeSlots: [
                { id: 11, startTime: new Date("2026-10-07T11:00:00Z") },
                { id: 12, startTime: new Date("2026-10-14T11:00:00Z") },
                { id: 13, startTime: new Date("2026-10-07T11:00:00Z") },
            ],
        }));
        broadcastToEvent.mockResolvedValue({ telegram: sent, discord: sent });

        const result = await runReminders(NOW);

        expect(broadcastToEvent).toHaveBeenCalledTimes(1);
        expect(prismaMock.timeSlot.updateMany).toHaveBeenCalledTimes(1);
        expect(prismaMock.timeSlot.updateMany).toHaveBeenCalledWith(slotClaim(11));
        expect(result.session.sent).toBe(1);
    });

    it("still sends exactly once when the run lands 3 hours into the lead window", async () => {
        const late = new Date("2026-10-07T13:00:00Z");
        sessionEvents(baseEvent({
            finalizedSlotId: 7,
            sessionReminderLeadMinutes: 1440,
            timeSlots: [{ id: 7, startTime: new Date("2026-10-08T10:00:00Z") }],
        }));
        broadcastToEvent.mockResolvedValue({ telegram: notLinked, discord: sent });

        const result = await runReminders(late);

        expect(broadcastToEvent).toHaveBeenCalledTimes(1);
        expect(result.session).toEqual({ sent: 1, failed: 0 });
    });

    it("sends nothing when a concurrent run already claimed the slot", async () => {
        sessionEvents(baseEvent({ finalizedSlotId: 7, timeSlots: [{ id: 7, startTime: new Date("2026-10-07T11:30:00Z") }] }));
        prismaMock.timeSlot.updateMany.mockResolvedValue({ count: 0 });

        const result = await runReminders(NOW);

        expect(broadcastToEvent).not.toHaveBeenCalled();
        expect(result.session).toEqual({ sent: 0, failed: 0 });
    });

    it("releases the slot claim when both platforms failed", async () => {
        sessionEvents(baseEvent({
            finalizedSlotId: 7,
            telegramChatId: "tg-1",
            timeSlots: [{ id: 7, startTime: new Date("2026-10-07T11:30:00Z") }],
        }));
        broadcastToEvent.mockResolvedValue({ telegram: failed, discord: failed });

        const result = await runReminders(NOW);

        expect(prismaMock.timeSlot.updateMany).toHaveBeenLastCalledWith({
            where: { id: 7, sessionReminderSentAt: NOW },
            data: { sessionReminderSentAt: null },
        });
        expect(result.session).toEqual({ sent: 0, failed: 1 });
    });
});

describe("runReminders: run status", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        resetDeadChannelsForTests();
    });

    it("reports ok=false when a whole run threw, and still runs the other", async () => {
        prismaMock.event.findMany.mockImplementation(async (args: FindManyArgs) => {
            if (typeof args.where.status === "object") throw new Error("db down");
            return [];
        });

        const result = await runReminders(NOW);

        expect(result.ok).toBe(false);
        expect(result.voting).toEqual({ sent: 0, failed: 1 });
        expect(result.session).toEqual({ sent: 0, failed: 0 });
    });
});

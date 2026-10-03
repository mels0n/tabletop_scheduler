import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock, broadcastToEvent } = vi.hoisted(() => ({
    prismaMock: {
        event: { findMany: vi.fn(), update: vi.fn() },
        timeSlot: { findUnique: vi.fn(), update: vi.fn() },
    },
    broadcastToEvent: vi.fn(),
}));

vi.mock("@/shared/lib/prisma", () => ({ default: prismaMock, prisma: prismaMock }));
vi.mock("../deliver", () => ({
    broadcastToEvent,
    isDelivered: (r: { telegram: { status: string }; discord: { status: string } }) =>
        r.telegram.status === "sent" || r.discord.status === "sent",
}));

import { runReminders } from "./index";

const sent = { status: "sent", messageId: "1" } as const;
const notLinked = { status: "skipped", reason: "not_linked" } as const;
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
        sessionReminderLeadMinutes: 120,
        ...overrides,
    };
}

describe("runReminders", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        prismaMock.event.findMany.mockResolvedValue([]);
    });

    it("sends a voting reminder to a Discord-only event and marks it sent", async () => {
        prismaMock.event.findMany.mockImplementation(async (args: { where: { status: unknown } }) =>
            typeof args.where.status === "object" ? [baseEvent()] : []
        );
        broadcastToEvent.mockResolvedValue({ telegram: notLinked, discord: sent });

        const summary = await runReminders(NOW);

        expect(broadcastToEvent).toHaveBeenCalledTimes(1);
        expect(broadcastToEvent.mock.calls[0][0].telegramChatId).toBeNull();
        expect(prismaMock.event.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { lastReminderSent: NOW } });
        expect(summary.voting).toEqual({ sent: 1, failed: 0 });
    });

    it("does not mark sent when delivery fails", async () => {
        prismaMock.event.findMany.mockImplementation(async (args: { where: { status: unknown } }) =>
            typeof args.where.status === "object" ? [baseEvent()] : []
        );
        broadcastToEvent.mockResolvedValue({ telegram: notLinked, discord: failed });

        const summary = await runReminders(NOW);

        expect(prismaMock.event.update).not.toHaveBeenCalled();
        expect(summary.voting).toEqual({ sent: 0, failed: 1 });
    });

    it("skips quietly without marking when nothing is linked", async () => {
        prismaMock.event.findMany.mockImplementation(async (args: { where: { status: unknown } }) =>
            typeof args.where.status === "object" ? [baseEvent({ discordChannelId: null })] : []
        );
        broadcastToEvent.mockResolvedValue({ telegram: notLinked, discord: notLinked });

        const summary = await runReminders(NOW);

        expect(prismaMock.event.update).not.toHaveBeenCalled();
        expect(summary.voting).toEqual({ sent: 0, failed: 0 });
    });

    it("sends a session reminder for a finalized one-shot event", async () => {
        const start = new Date("2026-10-07T11:30:00Z");
        prismaMock.event.findMany.mockImplementation(async (args: { where: { status: unknown } }) =>
            args.where.status === "FINALIZED" ? [baseEvent({ finalizedSlotId: 7, location: "The Dragon's Den" })] : []
        );
        prismaMock.timeSlot.findUnique.mockResolvedValue({ id: 7, startTime: start, sessionReminderSentAt: null });
        broadcastToEvent.mockResolvedValue({ telegram: notLinked, discord: sent });

        const summary = await runReminders(NOW);

        expect(broadcastToEvent).toHaveBeenCalledTimes(1);
        const html = broadcastToEvent.mock.calls[0][1].html as string;
        expect(html).toContain("Game Night");
        expect(html).toContain("The Dragon's Den");
        expect(html).toContain("/e/game-night");
        expect(prismaMock.timeSlot.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { sessionReminderSentAt: NOW } });
        expect(summary.session).toEqual({ sent: 1, failed: 0 });
    });

    it("sends a session reminder for a campaign FinalizedSession slot", async () => {
        const soon = new Date("2026-10-07T11:00:00Z");
        const later = new Date("2026-10-14T11:00:00Z");
        prismaMock.event.findMany.mockImplementation(async (args: { where: { status: unknown } }) =>
            args.where.status === "FINALIZED"
                ? [baseEvent({
                    eventType: "CAMPAIGN",
                    finalizedSessions: [
                        { timeSlotId: 11, timeSlot: { startTime: soon, sessionReminderSentAt: null } },
                        { timeSlotId: 12, timeSlot: { startTime: later, sessionReminderSentAt: null } },
                    ],
                })]
                : []
        );
        broadcastToEvent.mockResolvedValue({ telegram: sent, discord: sent });

        const summary = await runReminders(NOW);

        expect(broadcastToEvent).toHaveBeenCalledTimes(1);
        expect(prismaMock.timeSlot.update).toHaveBeenCalledTimes(1);
        expect(prismaMock.timeSlot.update).toHaveBeenCalledWith({ where: { id: 11 }, data: { sessionReminderSentAt: NOW } });
        expect(summary.session.sent).toBe(1);
    });

    it("does not mark a session sent when delivery fails", async () => {
        prismaMock.event.findMany.mockImplementation(async (args: { where: { status: unknown } }) =>
            args.where.status === "FINALIZED" ? [baseEvent({ finalizedSlotId: 7 })] : []
        );
        prismaMock.timeSlot.findUnique.mockResolvedValue({ id: 7, startTime: new Date("2026-10-07T11:30:00Z"), sessionReminderSentAt: null });
        broadcastToEvent.mockResolvedValue({ telegram: failed, discord: failed });

        const summary = await runReminders(NOW);

        expect(prismaMock.timeSlot.update).not.toHaveBeenCalled();
        expect(summary.session).toEqual({ sent: 0, failed: 1 });
    });

    it("isolates a failing event from the rest", async () => {
        prismaMock.event.findMany.mockImplementation(async (args: { where: { status: unknown } }) =>
            typeof args.where.status === "object"
                ? [baseEvent({ id: 1, slug: "a" }), baseEvent({ id: 2, slug: "b" })]
                : []
        );
        broadcastToEvent
            .mockRejectedValueOnce(new Error("kaboom"))
            .mockResolvedValueOnce({ telegram: notLinked, discord: sent });

        const summary = await runReminders(NOW);

        expect(summary.voting).toEqual({ sent: 1, failed: 1 });
        expect(prismaMock.event.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { lastReminderSent: NOW } });
    });
});

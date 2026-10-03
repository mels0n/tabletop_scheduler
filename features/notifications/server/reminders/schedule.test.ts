import { describe, it, expect } from "vitest";
import { isVotingReminderDue, isSessionReminderDue, parseReminderTime } from "./schedule";

const ALL_DAYS = "0,1,2,3,4,5,6";

function voting(overrides: Partial<Parameters<typeof isVotingReminderDue>[0]> = {}) {
    return {
        reminderTime: "10:00",
        reminderDays: ALL_DAYS,
        timezone: "UTC",
        lastReminderSent: null,
        ...overrides,
    };
}

// 2026-10-07 is a Wednesday (day 3).
const at = (iso: string) => new Date(iso);

describe("parseReminderTime", () => {
    it("parses 24h and 12h formats", () => {
        expect(parseReminderTime("10:30")).toBe(630);
        expect(parseReminderTime("10:30 PM")).toBe(22 * 60 + 30);
        expect(parseReminderTime("12:15 AM")).toBe(15);
        expect(parseReminderTime("12:00 PM")).toBe(720);
        expect(parseReminderTime("garbage")).toBeNull();
    });
});

describe("isVotingReminderDue", () => {
    it("is due exactly on time", () => {
        expect(isVotingReminderDue(voting(), at("2026-10-07T10:00:00Z"))).toBe(true);
    });

    it("is due 90 minutes late", () => {
        expect(isVotingReminderDue(voting(), at("2026-10-07T11:30:00Z"))).toBe(true);
    });

    it("catches up a run 3 hours late", () => {
        expect(isVotingReminderDue(voting(), at("2026-10-07T13:00:00Z"))).toBe(true);
    });

    it("is due until 18 hours after the target, and not at 18 hours", () => {
        expect(isVotingReminderDue(voting(), at("2026-10-08T03:59:00Z"))).toBe(true);
        expect(isVotingReminderDue(voting(), at("2026-10-08T04:00:00Z"))).toBe(false);
    });

    it("is not due before the time", () => {
        expect(isVotingReminderDue(voting(), at("2026-10-07T09:59:00Z"))).toBe(false);
    });

    it("wraps past midnight and uses the target's day of week", () => {
        // Target Tuesday 23:30, run Wednesday 00:15 UTC.
        const tuesdayOnly = voting({ reminderTime: "23:30", reminderDays: "2" });
        expect(isVotingReminderDue(tuesdayOnly, at("2026-10-07T00:15:00Z"))).toBe(true);

        // Wednesday-only schedule must NOT fire at Wednesday 00:15 (target was Tuesday).
        const wednesdayOnly = voting({ reminderTime: "23:30", reminderDays: "3" });
        expect(isVotingReminderDue(wednesdayOnly, at("2026-10-07T00:15:00Z"))).toBe(false);
    });

    it("catches up a wrapped target within 18 hours but not after", () => {
        const s = voting({ reminderTime: "23:30" });
        expect(isVotingReminderDue(s, at("2026-10-07T01:01:00Z"))).toBe(true);
        expect(isVotingReminderDue(s, at("2026-10-07T17:30:00Z"))).toBe(false);
    });

    it("respects the day-of-week list", () => {
        expect(isVotingReminderDue(voting({ reminderDays: "1,5" }), at("2026-10-07T10:00:00Z"))).toBe(false);
        expect(isVotingReminderDue(voting({ reminderDays: "3" }), at("2026-10-07T10:00:00Z"))).toBe(true);
    });

    it("dedupes on the target instant: once per target, never blocking the next day", () => {
        const now = at("2026-10-07T10:30:00Z");
        // Sent at or after today's 10:00 target: done for today.
        expect(isVotingReminderDue(voting({ lastReminderSent: at("2026-10-07T10:00:00Z") }), now)).toBe(false);
        // Sent before today's target (yesterday's late catch-up at 03:00): today's still fires.
        expect(isVotingReminderDue(voting({ lastReminderSent: at("2026-10-07T03:00:00Z") }), now)).toBe(true);
    });

    /** Simulates the 10-minute scheduler from `from` to `to`; returns the instants it sent. */
    function simulate(
        schedule: ReturnType<typeof voting>,
        from: string,
        to: string,
        down?: { from: string; to: string },
    ): string[] {
        const sent: string[] = [];
        let last = schedule.lastReminderSent as Date | null;
        for (let t = at(from).getTime(); t <= at(to).getTime(); t += 10 * 60_000) {
            if (down && t >= at(down.from).getTime() && t < at(down.to).getTime()) continue;
            const now = new Date(t);
            if (isVotingReminderDue({ ...schedule, lastReminderSent: last }, now)) {
                sent.push(now.toISOString());
                last = now;
            }
        }
        return sent;
    }

    it("enabled after today's target: nothing until tomorrow's target", () => {
        // Settings saved at 12:00 stamp lastReminderSent = 12:00; the 10:00 target already passed.
        const s = voting({ lastReminderSent: at("2026-10-07T12:00:00Z") });
        expect(simulate(s, "2026-10-07T12:00:00Z", "2026-10-08T12:00:00Z")).toEqual(["2026-10-08T10:00:00.000Z"]);
    });

    it("time moved earlier: fires at the new time the next day, not immediately", () => {
        // Sent at 15:00 under the old schedule, then moved to 10:00 at 16:00 (stamping 16:00).
        const s = voting({ reminderTime: "10:00", lastReminderSent: at("2026-10-07T16:00:00Z") });
        expect(simulate(s, "2026-10-07T16:00:00Z", "2026-10-08T12:00:00Z")).toEqual(["2026-10-08T10:00:00.000Z"]);
    });

    it("17 hour outage: at most one catch-up send, and the next day still fires on time", () => {
        const s = voting({ lastReminderSent: at("2026-10-06T10:00:00Z") });
        const sent = simulate(s, "2026-10-07T09:00:00Z", "2026-10-08T12:00:00Z", {
            from: "2026-10-07T09:30:00Z",
            to: "2026-10-08T02:30:00Z",
        });
        expect(sent).toEqual(["2026-10-08T02:30:00.000Z", "2026-10-08T10:00:00.000Z"]);
    });

    it("handles AM/PM times", () => {
        const s = voting({ reminderTime: "7:00 PM" });
        expect(isVotingReminderDue(s, at("2026-10-07T19:10:00Z"))).toBe(true);
        expect(isVotingReminderDue(s, at("2026-10-07T18:50:00Z"))).toBe(false);
    });

    it("evaluates in the event timezone", () => {
        const s = voting({ timezone: "America/New_York" });
        // 14:00 UTC = 10:00 EDT
        expect(isVotingReminderDue(s, at("2026-10-07T14:00:00Z"))).toBe(true);
        expect(isVotingReminderDue(s, at("2026-10-07T10:00:00Z"))).toBe(false);
    });

    describe("across DST transitions (one send per target)", () => {
        it("America/New_York fall-back 2026-11-01: no second send between 01:10 and 03:50 local", () => {
            const s = voting({ timezone: "America/New_York" });
            expect(simulate(s, "2026-10-31T13:00:00Z", "2026-11-01T16:00:00Z")).toEqual([
                "2026-10-31T14:00:00.000Z", // 10:00 EDT
                "2026-11-01T15:00:00.000Z", // 10:00 EST
            ]);
        });

        it("Europe/Berlin fall-back 2026-10-25", () => {
            const s = voting({ timezone: "Europe/Berlin" });
            expect(simulate(s, "2026-10-24T07:00:00Z", "2026-10-25T10:00:00Z")).toEqual([
                "2026-10-24T08:00:00.000Z", // 10:00 CEST
                "2026-10-25T09:00:00.000Z", // 10:00 CET
            ]);
        });

        it("America/New_York spring-forward 2026-03-08", () => {
            const s = voting({ timezone: "America/New_York" });
            expect(simulate(s, "2026-03-07T14:00:00Z", "2026-03-08T15:00:00Z")).toEqual([
                "2026-03-07T15:00:00.000Z", // 10:00 EST
                "2026-03-08T14:00:00.000Z", // 10:00 EDT
            ]);
        });

        it("a target inside the spring-forward gap fires once, as soon as the clock passes it", () => {
            const s = voting({ timezone: "America/New_York", reminderTime: "02:30" });
            expect(simulate(s, "2026-03-07T07:00:00Z", "2026-03-09T07:00:00Z")).toEqual([
                "2026-03-07T07:30:00.000Z", // 02:30 EST
                "2026-03-08T07:00:00.000Z", // 03:00 EDT, 02:30 never happened
                "2026-03-09T06:30:00.000Z", // 02:30 EDT
            ]);
        });

        it("a target inside the repeated fall-back hour fires once, on its first occurrence", () => {
            const s = voting({ timezone: "America/New_York", reminderTime: "01:30" });
            expect(simulate(s, "2026-10-31T05:00:00Z", "2026-11-02T07:00:00Z")).toEqual([
                "2026-10-31T05:30:00.000Z", // 01:30 EDT
                "2026-11-01T05:30:00.000Z", // first 01:30 (EDT); the second (EST) is the same target
                "2026-11-02T06:30:00.000Z", // 01:30 EST
            ]);
        });
    });

    it("returns false for missing or invalid config", () => {
        expect(isVotingReminderDue(voting({ reminderTime: null }), at("2026-10-07T10:00:00Z"))).toBe(false);
        expect(isVotingReminderDue(voting({ reminderDays: "" }), at("2026-10-07T10:00:00Z"))).toBe(false);
        expect(isVotingReminderDue(voting({ reminderTime: "nope" }), at("2026-10-07T10:00:00Z"))).toBe(false);
    });
});

describe("isSessionReminderDue", () => {
    const start = new Date("2026-10-10T18:00:00Z");

    it("is not due before the lead window opens", () => {
        expect(isSessionReminderDue(start, 120, new Date("2026-10-10T15:59:00Z"))).toBe(false);
    });

    it("is due at the start of the lead window and until the session starts", () => {
        expect(isSessionReminderDue(start, 120, new Date("2026-10-10T16:00:00Z"))).toBe(true);
        expect(isSessionReminderDue(start, 120, new Date("2026-10-10T17:59:00Z"))).toBe(true);
    });

    it("catches up a run hours after the window opened", () => {
        expect(isSessionReminderDue(start, 2880, new Date("2026-10-08T23:00:00Z"))).toBe(true);
    });

    it("is not due once the session has started", () => {
        expect(isSessionReminderDue(start, 120, new Date("2026-10-10T18:00:00Z"))).toBe(false);
        expect(isSessionReminderDue(start, 120, new Date("2026-10-10T19:00:00Z"))).toBe(false);
    });

    it("is not due without a positive lead time", () => {
        expect(isSessionReminderDue(start, null, new Date("2026-10-10T17:00:00Z"))).toBe(false);
        expect(isSessionReminderDue(start, 0, new Date("2026-10-10T17:00:00Z"))).toBe(false);
    });
});

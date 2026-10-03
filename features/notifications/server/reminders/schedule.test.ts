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

    it("dedupes within 18 hours but not after", () => {
        const now = at("2026-10-07T10:00:00Z");
        const recent = new Date(now.getTime() - 17 * 3600_000);
        const old = new Date(now.getTime() - 19 * 3600_000);
        expect(isVotingReminderDue(voting({ lastReminderSent: recent }), now)).toBe(false);
        expect(isVotingReminderDue(voting({ lastReminderSent: old }), now)).toBe(true);
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

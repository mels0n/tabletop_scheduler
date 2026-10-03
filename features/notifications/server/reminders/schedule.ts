/**
 * Pure scheduling rules for automated reminders. No I/O: callers pass `now`.
 */

/**
 * How long after its target a voting reminder may still go out. The scheduler is a
 * 10-minute pg_cron job with an hours-apart GitHub Actions backstop, so a run can land
 * well after the target; any run inside this window catches up. It is shorter than a
 * day so a missed reminder never collides with the next day's.
 */
export const VOTING_CATCHUP_MS = 18 * 60 * 60 * 1000;
const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface VotingReminderSchedule {
    reminderTime: string | null;
    reminderDays: string | null;
    timezone: string | null;
    lastReminderSent: Date | null;
}

/** Parses "HH:mm" or "h:mm AM/PM" into minutes since midnight, or null if unparseable. */
export function parseReminderTime(value: string): number | null {
    const lower = value.toLowerCase();
    const [rawH, rawM] = value.split(":").map(part => parseInt(part.replace(/\D/g, ""), 10));
    if (Number.isNaN(rawH) || Number.isNaN(rawM)) return null;
    let h = rawH;
    if (lower.includes("pm") && h < 12) h += 12;
    if (lower.includes("am") && h === 12) h = 0;
    return h * 60 + rawM;
}

/** Wall-clock minutes since midnight and weekday (0=Sun) of `now` in `timezone`. */
function localClock(now: Date, timezone: string): { minutes: number; weekday: number } {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hourCycle: "h23",
        hour: "numeric",
        minute: "numeric",
        weekday: "short",
    }).formatToParts(now);
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
    return {
        minutes: (parseInt(get("hour"), 10) % 24) * 60 + parseInt(get("minute"), 10),
        weekday: WEEKDAYS[get("weekday")] ?? 0,
    };
}

/**
 * The instant of the most recent "reminderTime on a reminder day", or null when no
 * target is open right now.
 *
 * A target stays open from its instant until 18 hours after (catch-up for late scheduler
 * runs). The window wraps midnight: a 23:30 target is still open at 00:15 the next day,
 * judged against the target's own weekday (yesterday), not today's.
 */
export function currentVotingTarget(schedule: VotingReminderSchedule, now: Date): Date | null {
    if (!schedule.reminderTime || !schedule.reminderDays) return null;

    const target = parseReminderTime(schedule.reminderTime);
    if (target === null) return null;

    const days = schedule.reminderDays.split(",").map(d => parseInt(d, 10)).filter(n => !Number.isNaN(n));
    if (days.length === 0) return null;

    let clock: { minutes: number; weekday: number };
    try {
        clock = localClock(now, schedule.timezone || "UTC");
    } catch {
        clock = localClock(now, "UTC");
    }

    let diff = clock.minutes - target;
    let targetWeekday = clock.weekday;
    if (diff < 0) {
        diff += 24 * 60;
        targetWeekday = (clock.weekday + 6) % 7;
    }

    if (diff * 60_000 >= VOTING_CATCHUP_MS) return null;
    if (!days.includes(targetWeekday)) return null;

    const minuteStart = now.getTime() - (now.getTime() % 60_000);
    return new Date(minuteStart - diff * 60_000);
}

/**
 * True when a voting reminder should post now: a target is open and nothing was sent
 * (or the settings were last changed) at or after that target. Dedupe is keyed on the
 * target instant, so each target sends at most once, a late catch-up never blocks the
 * next day's target, and enabling reminders after today's target waits for tomorrow.
 */
export function isVotingReminderDue(schedule: VotingReminderSchedule, now: Date): boolean {
    const target = currentVotingTarget(schedule, now);
    if (!target) return false;
    return !schedule.lastReminderSent || schedule.lastReminderSent.getTime() < target.getTime();
}

/**
 * True when `slotStart - lead <= now < slotStart`. Any run inside that span sends
 * (catch-up); whether it was already sent is decided by the claim, not here.
 */
export function isSessionReminderDue(slotStart: Date, leadMinutes: number | null, now: Date): boolean {
    if (!leadMinutes || leadMinutes <= 0) return false;
    const start = slotStart.getTime();
    const nowMs = now.getTime();
    return nowMs >= start - leadMinutes * 60_000 && nowMs < start;
}

/**
 * Pure scheduling rules for automated reminders. No I/O: callers pass `now`.
 */

const LATE_WINDOW_MINUTES = 90;
const DEDUPE_MS = 18 * 60 * 60 * 1000;
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
 * True when a voting reminder should post now.
 *
 * The target is "reminderTime on a reminder day". It is due from the target
 * until 90 minutes after (hourly cron plus delay). The window wraps midnight:
 * a 23:30 target is still due at 00:15 the next day, judged against the
 * target's own weekday (yesterday), not today's.
 */
export function isVotingReminderDue(schedule: VotingReminderSchedule, now: Date): boolean {
    if (!schedule.reminderTime || !schedule.reminderDays) return false;

    const target = parseReminderTime(schedule.reminderTime);
    if (target === null) return false;

    const days = schedule.reminderDays.split(",").map(d => parseInt(d, 10)).filter(n => !Number.isNaN(n));
    if (days.length === 0) return false;

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

    if (diff > LATE_WINDOW_MINUTES) return false;
    if (!days.includes(targetWeekday)) return false;

    if (schedule.lastReminderSent && now.getTime() - schedule.lastReminderSent.getTime() < DEDUPE_MS) {
        return false;
    }
    return true;
}

export interface SessionReminderSchedule {
    startTime: Date;
    leadMinutes: number | null;
    sentAt: Date | null;
}

/** True when `start - lead <= now < start` and the session has not been announced yet. */
export function isSessionReminderDue(schedule: SessionReminderSchedule, now: Date): boolean {
    if (schedule.sentAt) return false;
    if (!schedule.leadMinutes || schedule.leadMinutes <= 0) return false;
    const start = schedule.startTime.getTime();
    const nowMs = now.getTime();
    return nowMs >= start - schedule.leadMinutes * 60_000 && nowMs < start;
}

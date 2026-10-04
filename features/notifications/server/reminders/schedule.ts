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

/** UTC offset of `timezone` at `at`, in ms (positive east of Greenwich). */
function offsetMs(at: number, timezone: string): number {
    const name = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "longOffset" })
        .formatToParts(new Date(at))
        .find(p => p.type === "timeZoneName")?.value ?? "GMT";
    const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(name);
    if (!m) return 0;
    const minutes = parseInt(m[2], 10) * 60 + parseInt(m[3] ?? "0", 10);
    return (m[1] === "-" ? -1 : 1) * minutes * 60_000;
}

/**
 * The instant whose local wall time in `timezone` is `diffMs` of wall-clock time before
 * the local wall time of `nowMs`. Subtracting the wall-clock difference from `nowMs`
 * directly is off by the DST shift whenever a transition lies between the two, which
 * made a fall-back night re-send the previous day's reminder. The naive candidate is
 * corrected by the offset change and iterated once.
 *
 * Wall times that do not exist (spring-forward gap) resolve to the naive candidate, which
 * is never in the future; wall times that occur twice (fall-back overlap) resolve to the
 * earlier instant, so both passes of the repeated hour map to one target.
 */
function wallClockInstant(nowMs: number, diffMs: number, timezone: string): number {
    const naive = nowMs - diffMs;
    const offNow = offsetMs(nowMs, timezone);
    let t = naive + offNow - offsetMs(naive, timezone);
    t = naive + offNow - offsetMs(t, timezone);
    if (t > nowMs) t = naive;

    const wall = t + offsetMs(t, timezone);
    const earlier = wall - offsetMs(t - 3 * 60 * 60 * 1000, timezone);
    if (earlier < t && earlier + offsetMs(earlier, timezone) === wall) t = earlier;
    return t;
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

    let timezone = schedule.timezone || "UTC";
    let clock: { minutes: number; weekday: number };
    try {
        clock = localClock(now, timezone);
    } catch {
        timezone = "UTC";
        clock = localClock(now, timezone);
    }

    let diff = clock.minutes - target;
    let targetWeekday = clock.weekday;
    if (diff < 0) {
        diff += 24 * 60;
        targetWeekday = (clock.weekday + 6) % 7;
    }

    if (!days.includes(targetWeekday)) return null;

    const minuteStart = now.getTime() - (now.getTime() % 60_000);
    const instant = wallClockInstant(minuteStart, diff * 60_000, timezone);
    if (minuteStart - instant >= VOTING_CATCHUP_MS) return null;
    return new Date(instant);
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

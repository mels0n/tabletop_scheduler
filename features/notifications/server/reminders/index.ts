import { runVotingReminders } from "./voting";
import { runSessionReminders } from "./session";
import type { ReminderRunSummary } from "./types";
import Logger from "@/shared/lib/logger";

const log = Logger.get("Reminders");

export interface ReminderRunResult {
    /** False when a whole run threw (e.g. the database was unreachable). Per-event failures are counted, not fatal. */
    ok: boolean;
    voting: ReminderRunSummary;
    session: ReminderRunSummary;
}

/** Runs both reminder types. One failing never blocks the other. */
export async function runReminders(now: Date = new Date()): Promise<ReminderRunResult> {
    let ok = true;
    const voting = await runVotingReminders(now).catch((e) => {
        ok = false;
        log.error("Voting reminder run failed", e as Error);
        return { sent: 0, failed: 1 };
    });
    const session = await runSessionReminders(now).catch((e) => {
        ok = false;
        log.error("Session reminder run failed", e as Error);
        return { sent: 0, failed: 1 };
    });
    return { ok, voting, session };
}

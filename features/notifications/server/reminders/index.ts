import { runVotingReminders } from "./voting";
import { runSessionReminders } from "./session";
import type { ReminderRunSummary } from "./types";
import Logger from "@/shared/lib/logger";

const log = Logger.get("Reminders");

export interface ReminderRunResult {
    voting: ReminderRunSummary;
    session: ReminderRunSummary;
}

/** Runs both reminder types. One failing never blocks the other. */
export async function runReminders(now: Date = new Date()): Promise<ReminderRunResult> {
    const voting = await runVotingReminders(now).catch((e) => {
        log.error("Voting reminder run failed", e as Error);
        return { sent: 0, failed: 1 };
    });
    const session = await runSessionReminders(now).catch((e) => {
        log.error("Session reminder run failed", e as Error);
        return { sent: 0, failed: 1 };
    });
    return { voting, session };
}

/**
 * Allowed session reminder lead times, in minutes before the session starts:
 * 2 hours, 1 day, 2 days. The server action allowlists against this list and the
 * manage page renders its options from it, so the two can never disagree.
 */
export const SESSION_REMINDER_LEADS = [120, 1440, 2880] as const;

export type SessionReminderLead = (typeof SESSION_REMINDER_LEADS)[number];

export function isSessionReminderLead(value: number): value is SessionReminderLead {
    return (SESSION_REMINDER_LEADS as readonly number[]).includes(value);
}

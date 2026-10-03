export interface ReminderRunSummary {
    sent: number;
    failed: number;
}

export function escapeHtml(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** True when neither Telegram nor Discord is linked, so there was nowhere to post. */
export function isNothingLinked(result: {
    telegram: { status: string; reason?: string };
    discord: { status: string; reason?: string };
}): boolean {
    return (
        result.telegram.status === "skipped" && result.telegram.reason === "not_linked" &&
        result.discord.status === "skipped" && result.discord.reason === "not_linked"
    );
}

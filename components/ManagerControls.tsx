"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteEvent, cancelEvent, updateReminderSettings, updateSessionReminderSettings } from "@/features/event-management/server/actions";
import { Loader2, Trash2, AlertTriangle, Bell } from "lucide-react";
import { SESSION_REMINDER_LEADS, type SessionReminderLead } from "@/features/notifications/model/leads";

/**
 * @interface ManagerControlsProps
 * @description Props for the ManagerControls (Event Settings) component.
 * @property {string} slug - The event slug.
 * @property {boolean} isFinalized - Whether the event is in a finalized state.
 * @property {boolean} isCancelled - Whether the event is cancelled.
 * @property {boolean} isTelegramConnected - Used to gate Reminder settings.
 * @property {boolean} isDiscordConnected - Used to gate Reminder settings.
 * @property {boolean} initialReminderEnabled - Saved state of reminder setting.
 * @property {string | null} initialReminderTime - Saved reminder time (HH:MM).
 * @property {string | null} initialReminderDays - Saved reminder days (csv string).
 * @property {boolean} initialSessionReminderEnabled - Saved state of the session reminder setting.
 * @property {number | null} initialSessionReminderLeadMinutes - Saved session reminder lead time in minutes.
 */
interface ManagerControlsProps {
    slug: string;
    isFinalized: boolean;
    isCancelled?: boolean;
    isTelegramConnected: boolean;
    isDiscordConnected: boolean;
    // Reminder Init Props
    initialReminderEnabled: boolean;
    initialReminderTime: string | null;
    initialReminderDays: string | null;
    initialSessionReminderEnabled: boolean;
    initialSessionReminderLeadMinutes: number | null;
}

const SESSION_LEAD_LABELS: Record<SessionReminderLead, string> = {
    120: "2 hours before",
    1440: "1 day before",
    2880: "2 days before",
};

const SESSION_LEAD_OPTIONS = SESSION_REMINDER_LEADS.map(value => ({ value, label: SESSION_LEAD_LABELS[value] }));

/**
 * @component ManagerControls
 * @description The settings panel for event organizers.
 * Features:
 * 1. Automated Reminder Scheduling.
 * 2. Event Lifecycle Management (Cancel/Delete).
 *
 * @param {ManagerControlsProps} props - Component props.
 * @returns {JSX.Element} The manager settings UI.
 */
export function ManagerControls({
    slug,
    isFinalized,
    isCancelled = false,
    isTelegramConnected,
    isDiscordConnected,
    initialReminderEnabled,
    initialReminderTime,
    initialReminderDays,
    initialSessionReminderEnabled,
    initialSessionReminderLeadMinutes
}: ManagerControlsProps) {

    // Delete state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState("");

    const router = useRouter();

    /**
     * Helper: Parse initial days string "1,2,3" -> [1, 2, 3]
     */
    const parseDays = (str: string | null) => {
        if (!str) return [];
        return str.split(',').map(d => parseInt(d)).filter(n => !isNaN(n));
    };

    // Reminder State
    const [reminderEnabled, setReminderEnabled] = useState(initialReminderEnabled);
    const [reminderTime, setReminderTime] = useState(initialReminderTime || "10:00");
    const [reminderDays, setReminderDays] = useState<number[]>(parseDays(initialReminderDays));
    const [isSavingReminders, setIsSavingReminders] = useState(false);
    const [reminderMessage, setReminderMessage] = useState("");
    const [reminderError, setReminderError] = useState("");

    // Session Reminder State
    const [sessionEnabled, setSessionEnabled] = useState(initialSessionReminderEnabled);
    const [sessionLead, setSessionLead] = useState<number>(initialSessionReminderLeadMinutes ?? 1440);
    const [isSavingSession, setIsSavingSession] = useState(false);
    const [sessionMessage, setSessionMessage] = useState("");
    const [sessionError, setSessionError] = useState("");

    /**
     * Handles Event Deletion or Cancellation depending on state.
     */
    const handleAction = async () => {
        setIsDeleting(true);
        try {
            // Intent: Choose action based on state (Cancellation for finalized, Deletion for draft/cancelled)
            // If it's already cancelled, we want to delete it.
            const actionPromise = (isFinalized && !isCancelled) ? cancelEvent(slug) : deleteEvent(slug);
            const res = await actionPromise;

            if ('error' in res) {
                setError(res.error || "Unknown error");
                setIsDeleting(false);
            } else {
                if (isFinalized && !isCancelled) {
                    // Cancelled -> Refresh to show cancelled state
                    router.refresh();
                    setShowDeleteConfirm(false);
                    setIsDeleting(false);
                } else {
                    // Deleted -> Redirect home
                    router.push("/");
                }
            }
        } catch (e) {
            setError(`Failed to ${isFinalized ? 'cancel' : 'delete'} event.`);
            setIsDeleting(false);
        }
    };

    const hasAnyConnection = isTelegramConnected || isDiscordConnected;

    return (
        <div className="space-y-4">

            {/* Reminder Scheduler - Only if Connected */}
            {hasAnyConnection ? (
                <div className="p-4 bg-surface border border-line rounded-card space-y-4">
                    <h3 className="font-semibold text-parchment flex items-center gap-2">
                        <Bell className="size-5 text-gold-bright" aria-hidden="true" />
                        Reminder Scheduler
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <h4 className="text-sm font-semibold text-parchment-2">Voting reminders</h4>
                            <p className="text-xs text-mist">While voting is open, post a nudge in the group/channel on the days and time you pick. Nudges stop once a time has enough players, or when no proposed time is left in the future.</p>
                        </div>
                        <label className="flex items-center gap-3 p-3 bg-field rounded-control border border-line cursor-pointer hover:border-gold transition-colors">
                            <input
                                type="checkbox"
                                checked={reminderEnabled}
                                onChange={e => setReminderEnabled(e.target.checked)}
                                className="w-5 h-5 accent-gold rounded-[3px] bg-field border-line-strong"
                            />
                            <div className="flex-1">
                                <span className="font-medium text-parchment block">Enable voting reminders</span>
                                <span className="text-xs text-mist">Post a reminder in the group/channel automatically.</span>
                            </div>
                        </label>

                        {reminderEnabled && (
                            <div className="space-y-4 animation-in slide-in-from-top-2 fade-in">
                                {/* Time Picker */}
                                <div>
                                    <label className="block text-xs font-medium text-mist mb-1">Time of Day (Event Timezone)</label>
                                    <input
                                        type="time"
                                        value={reminderTime}
                                        onChange={e => setReminderTime(e.target.value)}
                                        className="bg-field border border-line-strong text-parchment text-sm rounded-control block w-full p-2.5 focus:ring-gold focus:border-gold"
                                    />
                                </div>

                                {/* Day Picker */}
                                <div>
                                    <label className="block text-xs font-medium text-mist mb-2">Days of Week</label>
                                    <div className="flex gap-2 justify-between">
                                        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                                            <button
                                                key={i}
                                                onClick={() => {
                                                    setReminderDays(prev =>
                                                        prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                                                    )
                                                }}
                                                className={`w-8 h-8 rounded-control text-xs font-bold flex items-center justify-center transition-all ${reminderDays.includes(i)
                                                    ? "bg-gold text-on-gold "
                                                    : "bg-surface-2 text-mist hover:text-parchment"
                                                    }`}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {reminderMessage && <p className="text-yes text-sm font-medium text-center">{reminderMessage}</p>}
                                    {reminderError && <p className="text-no text-sm font-medium text-center">{reminderError}</p>}

                                    <button
                                        onClick={async () => {
                                            setIsSavingReminders(true);
                                            setReminderMessage("");
                                            setReminderError("");

                                            // Using direct import is safer for Server Actions bundler
                                            const res = await updateReminderSettings(slug, reminderEnabled, reminderTime, reminderDays);

                                            setIsSavingReminders(false);
                                            if (res.success) {
                                                setReminderMessage("✅ Schedule Saved");
                                                setTimeout(() => setReminderMessage(""), 3000); // clear after 3s
                                            } else {
                                                setReminderError("Failed to save schedule");
                                            }
                                        }}
                                        className="w-full py-2 bg-gold hover:bg-gold-bright text-on-gold rounded-control text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isSavingReminders ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Schedule"}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Session reminders */}
                        <div className="pt-4 border-t border-line space-y-4">
                            <div>
                                <h4 className="text-sm font-semibold text-parchment-2">Session reminders</h4>
                                <p className="text-xs text-mist">Once a session is scheduled, post a heads-up in the group/channel before it starts.</p>
                            </div>

                            <label className="flex items-center gap-3 p-3 bg-field rounded-control border border-line cursor-pointer hover:border-gold transition-colors">
                                <input
                                    type="checkbox"
                                    checked={sessionEnabled}
                                    onChange={e => setSessionEnabled(e.target.checked)}
                                    className="w-5 h-5 accent-gold rounded-[3px] bg-field border-line-strong"
                                />
                                <div className="flex-1">
                                    <span className="font-medium text-parchment block">Enable session reminders</span>
                                    <span className="text-xs text-mist">Only sent for scheduled sessions, once per session.</span>
                                </div>
                            </label>

                            {sessionEnabled && (
                                <div className="space-y-4 animation-in slide-in-from-top-2 fade-in">
                                    <div>
                                        <label className="block text-xs font-medium text-mist mb-1">Send reminder</label>
                                        <select
                                            value={sessionLead}
                                            onChange={e => setSessionLead(parseInt(e.target.value))}
                                            className="bg-field border border-line-strong text-parchment text-sm rounded-control block w-full p-2.5 focus:ring-gold focus:border-gold"
                                        >
                                            {SESSION_LEAD_OPTIONS.map(o => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                {sessionMessage && <p className="text-yes text-sm font-medium text-center">{sessionMessage}</p>}
                                {sessionError && <p className="text-no text-sm font-medium text-center">{sessionError}</p>}

                                <button
                                    onClick={async () => {
                                        setIsSavingSession(true);
                                        setSessionMessage("");
                                        setSessionError("");

                                        const res = await updateSessionReminderSettings(slug, sessionEnabled, sessionLead);

                                        setIsSavingSession(false);
                                        if (res.success) {
                                            setSessionMessage("✅ Session reminders saved");
                                            setTimeout(() => setSessionMessage(""), 3000);
                                        } else {
                                            setSessionError("Failed to save session reminders");
                                        }
                                    }}
                                    className="w-full py-2 bg-gold hover:bg-gold-bright text-on-gold rounded-control text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    {isSavingSession ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Session Reminders"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-4 bg-surface border border-line rounded-card">
                    <div className="text-sm text-mist flex items-center gap-2">
                        <Bell className="size-5 opacity-50" aria-hidden="true" />
                        <span>Connect Telegram or Discord to enable reminders.</span>
                    </div>
                </div>
            )}

            {/* Danger Zone - Always Visible */}
            <div className={`p-4 rounded-card border ${isFinalized ? 'border-maybe bg-maybe-bg' : 'border-no bg-no-bg'} space-y-4`}>
                <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-semibold ${isFinalized ? 'text-maybe' : 'text-no'} flex items-center gap-2`}>
                        <Trash2 className="w-4 h-4" />
                        Danger Zone
                    </h3>
                    {!showDeleteConfirm && (
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className={`text-xs ${isFinalized ? 'text-maybe hover:text-gold-bright' : 'text-no hover:text-parchment'} underline`}
                        >
                            {isFinalized ? "Cancel Event..." : (isCancelled ? "Delete Event..." : "Delete Event...")}
                        </button>
                    )}
                </div>

                {showDeleteConfirm && (
                    <div className="space-y-3 animation-in fade-in slide-in-from-top-2">
                        <div className={`p-3 ${isFinalized && !isCancelled ? 'bg-maybe-bg border border-maybe text-maybe' : 'bg-no-bg border border-no text-no'} rounded-control text-xs flex gap-2`}>
                            <AlertTriangle className={`w-4 h-4 ${isFinalized && !isCancelled ? 'text-maybe' : 'text-no'} shrink-0`} />
                            <p>
                                <b>Warning:</b> {isFinalized && !isCancelled
                                    ? "This will cancel the event and post a notice in the connected group or channel. The event data is deleted one day after cancellation, or right away if you delete it afterwards."
                                    : (isCancelled
                                        ? "This event is already cancelled. Deleting it will permanently remove all data from the database."
                                        : "This action cannot be undone. All votes, participants, and data will be permanently erased."
                                    )
                                }
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-2 rounded-control bg-surface-2 hover:bg-line text-parchment-2 text-xs font-medium transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleAction}
                                disabled={isDeleting}
                                className="flex-1 btn-danger !py-2 !px-3 text-xs font-bold"
                            >
                                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                                    isFinalized && !isCancelled ? "Confirm Cancel" : (isCancelled ? "Confirm Delete" : "Confirm Delete")
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {error && <p className="text-no text-sm">{error}</p>}
        </div>
    );
}

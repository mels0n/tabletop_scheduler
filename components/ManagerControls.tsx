"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteEvent, cancelEvent } from "@/app/actions";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";

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
}

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
    initialReminderDays
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
        <div className="mt-6 space-y-4">

            {/* Reminder Scheduler - Only if Connected */}
            {hasAnyConnection ? (
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                    <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                        <span className="text-xl">🔔</span>
                        Reminder Scheduler
                    </h3>

                    <div className="space-y-4">
                        <label className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800 cursor-pointer hover:border-indigo-500/50 transition-colors">
                            <input
                                type="checkbox"
                                checked={reminderEnabled}
                                onChange={e => setReminderEnabled(e.target.checked)}
                                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 bg-slate-900 border-slate-700"
                            />
                            <div className="flex-1">
                                <span className="font-medium text-slate-200 block">Enable Automated Reminders</span>
                                <span className="text-xs text-slate-500">Post a reminder in the group/channel automatically.</span>
                            </div>
                        </label>

                        {reminderEnabled && (
                            <div className="space-y-4 animation-in slide-in-from-top-2 fade-in">
                                {/* Time Picker */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Time of Day (Event Timezone)</label>
                                    <input
                                        type="time"
                                        value={reminderTime}
                                        onChange={e => setReminderTime(e.target.value)}
                                        className="bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-lg block w-full p-2.5 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>

                                {/* Day Picker */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-2">Days of Week</label>
                                    <div className="flex gap-2 justify-between">
                                        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                                            <button
                                                key={i}
                                                onClick={() => {
                                                    setReminderDays(prev =>
                                                        prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                                                    )
                                                }}
                                                className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-all ${reminderDays.includes(i)
                                                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/50"
                                                    : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                                                    }`}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {reminderMessage && <p className="text-green-400 text-sm font-medium text-center">{reminderMessage}</p>}
                                    {reminderError && <p className="text-red-400 text-sm font-medium text-center">{reminderError}</p>}

                                    <button
                                        onClick={async () => {
                                            setIsSavingReminders(true);
                                            setReminderMessage("");
                                            setReminderError("");

                                            // Intent: Sticky lazy load or direct import depending on bundle pref.
                                            // Using direct import from top level for now as it's cleaner.
                                            // But we are in a client component, so we imported the server action at top.
                                            // We need to import updateReminderSettings.
                                            const { updateReminderSettings } = await import("@/app/actions");
                                            const res = await updateReminderSettings(slug, reminderEnabled, reminderTime, reminderDays);

                                            setIsSavingReminders(false);
                                            if (res.success) {
                                                setReminderMessage("✅ Schedule Saved");
                                                setTimeout(() => setReminderMessage(""), 3000); // clear after 3s
                                            } else {
                                                setReminderError("Failed to save schedule");
                                            }
                                        }}
                                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isSavingReminders ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Schedule"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                    <div className="text-sm text-slate-500 flex items-center gap-2">
                        <span className="text-lg opacity-50">🔔</span>
                        <span>Connect Telegram or Discord to enable reminders.</span>
                    </div>
                </div>
            )}

            {/* Danger Zone - Always Visible */}
            <div className={`p-4 rounded-xl border ${isFinalized ? 'border-orange-900/30 bg-orange-950/10' : 'border-red-900/30 bg-red-950/10'} space-y-4`}>
                <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-semibold ${isFinalized ? 'text-orange-400' : 'text-red-400'} flex items-center gap-2`}>
                        <Trash2 className="w-4 h-4" />
                        Danger Zone
                    </h3>
                    {!showDeleteConfirm && (
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className={`text-xs ${isFinalized ? 'text-orange-400 hover:text-orange-300' : 'text-red-400 hover:text-red-300'} underline`}
                        >
                            {isFinalized ? "Cancel Event..." : (isCancelled ? "Delete Event..." : "Delete Event...")}
                        </button>
                    )}
                </div>

                {showDeleteConfirm && (
                    <div className="space-y-3 animation-in fade-in slide-in-from-top-2">
                        <div className={`p-3 ${isFinalized && !isCancelled ? 'bg-orange-950/40 border border-orange-900/50 text-orange-200' : 'bg-red-950/40 border border-red-900/50 text-red-200'} rounded text-xs flex gap-2`}>
                            <AlertTriangle className={`w-4 h-4 ${isFinalized && !isCancelled ? 'text-orange-500' : 'text-red-500'} shrink-0`} />
                            <p>
                                <b>Warning:</b> {isFinalized && !isCancelled
                                    ? "This will cancel the event and notify all participants. The event data will be permanently removed."
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
                                className="flex-1 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleAction}
                                disabled={isDeleting}
                                className={`flex-1 py-2 rounded ${isFinalized && !isCancelled ? 'bg-orange-600 hover:bg-orange-500' : 'bg-red-600 hover:bg-red-500'} text-white text-xs font-bold shadow-lg ${isFinalized && !isCancelled ? 'shadow-orange-900/20' : 'shadow-red-900/20'} flex items-center justify-center gap-2`}
                            >
                                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : (
                                    isFinalized && !isCancelled ? "Confirm Cancel" : (isCancelled ? "Confirm Delete" : "Confirm Delete")
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
    );
}

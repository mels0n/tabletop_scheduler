"use client";

import { useState, useEffect } from "react";
import { dmManagerLink, checkManagerStatus, deleteEvent, cancelEvent } from "@/app/actions";
import { MessageCircle, Loader2, Trash2, AlertTriangle, Send, Check as CheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * @interface ManagerControlsProps
 * @description Props for the ManagerControls component.
 * @property {string} slug - The event slug.
 * @property {string | null} initialHandle - The Telegram handle of the manager (if known).
 * @property {boolean} hasManagerChatId - Whether the bot has verified the manager's chat ID (needed for DMs).
 * @property {boolean} isFinalized - Whether the event is in a finalized state.
 * @property {string} botUsername - The Telegram bot's username (for deep linking).
 * @property {string} recoveryToken - Token for the 'One-Click' recovery flow.
 * @property {boolean} initialReminderEnabled - Saved state of reminder setting.
 * @property {string | null} initialReminderTime - Saved reminder time (HH:MM).
 * @property {string | null} initialReminderDays - Saved reminder days (csv string).
 */
interface ManagerControlsProps {
    slug: string;
    initialHandle: string | null;
    hasManagerChatId: boolean;
    isFinalized: boolean;
    botUsername: string;
    recoveryToken: string;
    // Reminder Init Props
    initialReminderEnabled: boolean;
    initialReminderTime: string | null;
    initialReminderDays: string | null;
}

/**
 * @component ManagerControls
 * @description The primary control panel for event organizers.
 * Features:
 * 1. Manager Authentication/Recovery via Telegram Deep Links.
 * 2. Event Lifecycle Management (Cancel/Delete).
 * 3. Automated Reminder Scheduling.
 *
 * @param {ManagerControlsProps} props - Component props.
 * @returns {JSX.Element} The manager dashboard UI.
 */
export function ManagerControls({
    slug,
    initialHandle: propsInitialHandle,
    hasManagerChatId: initialHasId,
    isFinalized,
    botUsername,
    recoveryToken,
    initialReminderEnabled,
    initialReminderTime,
    initialReminderDays
}: ManagerControlsProps) {
    // Intent: Track local state for manager identity to update UI immediately upon polling success.
    const [initialHandle, setInitialHandle] = useState(propsInitialHandle);
    const [hasManagerChatId, setHasManagerChatId] = useState(initialHasId);

    // Delete state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // DM Action State
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
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

    // UI State for Reminders
    const [isEditing, setIsEditing] = useState(!initialReminderEnabled);
    const [isSavingReminders, setIsSavingReminders] = useState(false);
    const [reminderMessage, setReminderMessage] = useState("");
    const [reminderError, setReminderError] = useState("");

    // Intent: Polling mechanism to auto-detect when the user has finally messaged the bot.
    // This provides a "Real-time" feel during the setup process without websockets.
    useEffect(() => {
        // Poll if we don't have a chat ID yet, regardless of whether we have a handle (since we now capture handle via this flow)
        if (hasManagerChatId) return;

        const interval = setInterval(async () => {
            try {
                const status = await checkManagerStatus(slug);
                if (status.hasManagerChatId) {
                    setHasManagerChatId(true);
                    if (status.handle) setInitialHandle(status.handle);
                    router.refresh();
                }
            } catch (e) {
                // simple ignore background polling errors
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [hasManagerChatId, slug, router]);

    /**
     * Triggers the server action to send a Magic Link via Telegram DM.
     * Requires the bot to have a known Chat ID for the manager.
     */
    const handleDM = async () => {
        if (!hasManagerChatId) return;

        setLoading(true);
        setMessage("");
        setError("");

        try {
            const res = await dmManagerLink(slug);
            if (res.error) {
                setError(res.error);
            } else {
                setMessage("✅ Link sent! Check your DMs.");
            }
        } catch (e) {
            setError("Failed to send request.");
        } finally {
            setLoading(false);
        }
    };

    /**
     * Handles Event Deletion or Cancellation depending on state.
     */
    const handleAction = async () => {
        setIsDeleting(true);
        try {
            // Intent: Choose action based on state (Cancellation for finalized, Deletion for draft)
            const actionPromise = isFinalized ? cancelEvent(slug) : deleteEvent(slug);
            const res = await actionPromise;

            if ('error' in res) {
                setError(res.error || "Unknown error");
                setIsDeleting(false);
            } else {
                if (isFinalized) {
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

    return (
        <div className="mt-6 space-y-4">
            {/* Manager Connection / Setup Section */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-indigo-400" />
                    Manager Recovery
                </h3>

                {!hasManagerChatId ? (
                    // State: Setup Mode (No Chat ID yet)
                    <div className="space-y-3">
                        <p className="text-sm text-slate-400">
                            Not going to connect the bot to a group? Register to receive magic login links via DM.
                        </p>

                        <a
                            href={`https://t.me/${botUsername}?start=rec_${recoveryToken}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-indigo-600 hover:bg-indigo-500 text-white w-full py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-transparent shadow-lg shadow-indigo-900/20"
                        >
                            <Send className="w-4 h-4" />
                            Register for Magic Links
                        </a>
                        <p className="text-[10px] text-slate-500 text-center">
                            (This will open Telegram and start the bot to secure your link)
                        </p>
                    </div>
                ) : (
                    // State: Connected Mode (Has Chat ID)
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-sm text-green-400 bg-green-900/20 px-3 py-2 rounded-lg border border-green-900/50">
                            <CheckIcon className="w-4 h-4 shrink-0" />
                            <span className="font-medium">Registered for Magic Links</span>
                        </div>

                        {initialHandle && (
                            <div className="flex items-center justify-between text-sm text-slate-400 gap-4 px-1">
                                <span className="shrink-0">Manager Handle:</span>
                                <span className="font-mono text-slate-300 truncate">{initialHandle}</span>
                            </div>
                        )}

                        {message && <p className="text-green-400 text-sm font-medium px-1">{message}</p>}
                        {error && <p className="text-red-400 text-sm font-medium px-1">{error}</p>}

                        <button
                            onClick={handleDM}
                            disabled={loading || !hasManagerChatId}
                            className={`w-full py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 border ${loading || !hasManagerChatId
                                ? "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed"
                                : "bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border-indigo-500/30"
                                }`}
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Magic Link"}
                        </button>
                    </div>
                )}
            </div>

            {/* Reminder Scheduler - Only if Connected */}
            {hasManagerChatId && (
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
                                <span className="text-xs text-slate-500">Post a reminder in the group chat automatically.</span>
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

                                            // Intent: Lazy load action to reduce initial bundle size, or just standard import.
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
                            {isFinalized ? "Cancel Event..." : "Delete Event..."}
                        </button>
                    )}
                </div>

                {showDeleteConfirm && (
                    <div className="space-y-3 animation-in fade-in slide-in-from-top-2">
                        <div className={`p-3 ${isFinalized ? 'bg-orange-950/40 border border-orange-900/50 text-orange-200' : 'bg-red-950/40 border border-red-900/50 text-red-200'} rounded text-xs flex gap-2`}>
                            <AlertTriangle className={`w-4 h-4 ${isFinalized ? 'text-orange-500' : 'text-red-500'} shrink-0`} />
                            <p>
                                <b>Warning:</b> {isFinalized
                                    ? "This will cancel the event and notify all participants. The event data will be permanently removed."
                                    : "This action cannot be undone. All votes, participants, and data will be permanently erased."
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
                                className={`flex-1 py-2 rounded ${isFinalized ? 'bg-orange-600 hover:bg-orange-500' : 'bg-red-600 hover:bg-red-500'} text-white text-xs font-bold shadow-lg ${isFinalized ? 'shadow-orange-900/20' : 'shadow-red-900/20'} flex items-center justify-center gap-2`}
                            >
                                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : (isFinalized ? "Confirm Cancel" : "Confirm Delete")}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

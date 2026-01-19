"use client";

import { useState, useEffect } from "react";
import { recoverManagerLink } from "@/features/event-management/server/recovery";
import { recoverDiscordManagerLink } from "@/features/integrations/discord/server/actions";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * @component ManagerRecovery
 * @description A modal-based workflow to recover manager access.
 * If the manager loses their administrative cookie, this allows recovery via
 * their linked Telegram Handle or Discord Username.
 *
 * @param {Object} props - Component props.
 * @param {string} props.slug - The event slug.
 * @returns {JSX.Element} The recovery modal trigger and content.
 */
export function ManagerRecovery({ slug, defaultOpen = false }: { slug: string, defaultOpen?: boolean }) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(defaultOpen);

    // Intent: Sync internal state with prop changes (e.g. from URL redirects)
    useEffect(() => {
        setIsOpen(defaultOpen);
    }, [defaultOpen]);

    const [platform, setPlatform] = useState<"telegram" | "discord">("telegram");
    const [handle, setHandle] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    /**
     * Handles the recovery form submission.
     * Calls the server action to verify the handle and send the Telegram DM.
     */
    const handleRecover = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccessMsg("");

        try {
            const res = platform === 'telegram'
                ? await recoverManagerLink(slug, handle)
                : await recoverDiscordManagerLink(slug, handle);

            if (res.error) {
                setError(res.error);
            } else if ((res as any).success) {
                setSuccessMsg((res as any).message || (platform === 'telegram' ? "Recovery link sent to Telegram!" : "Recovery link sent to Discord!"));
            }
        } catch (err) {
            setError("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    // State 1: Collapsed Trigger Button
    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="text-xs text-slate-600 hover:text-indigo-400 transition-colors flex items-center gap-1 mx-auto mt-4"
            >
                <Lock className="w-3 h-3" />
                Lost Manager Link?
            </button>
        );
    }

    // State 2: Success Modal (Link Sent)
    if (successMsg) {
        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                <div className="bg-slate-900 border border-green-800/50 p-6 rounded-xl max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95">
                    <div className="flex flex-col items-center text-center gap-4">
                        <div className="w-12 h-12 bg-green-900/20 rounded-full flex items-center justify-center text-green-500">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-lg text-green-400">Recovery Sent!</h3>
                        <p className="text-slate-300 text-sm">{successMsg}</p>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="w-full px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // State 3: Active Form Modal
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl max-w-sm w-full shadow-2xl">
                <div className="flex items-center gap-2 mb-4 text-indigo-400">
                    <ShieldCheck className="w-6 h-6" />
                    <h3 className="font-bold text-lg">Recover Access</h3>
                </div>

                <p className="text-slate-400 text-sm mb-4">
                    Enter the Telegram Handle you provided when creating this event. We will verify it and send a <b>Magic Link</b> to your Telegram DMs.
                </p>

                <form onSubmit={handleRecover} className="space-y-4">

                    {/* Platform Toggle */}
                    <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-700">
                        <button
                            type="button"
                            onClick={() => setPlatform("telegram")}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${platform === "telegram" ? "bg-slate-800 text-sky-400 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
                        >
                            Telegram
                        </button>
                        <button
                            type="button"
                            onClick={() => setPlatform("discord")}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${platform === "discord" ? "bg-slate-800 text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-300"}`}
                        >
                            Discord
                        </button>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                            {platform === "telegram" ? "Telegram Handle" : "Discord Username"}
                        </label>
                        <input
                            type="text"
                            placeholder={platform === "telegram" ? "@YourHandle" : "username"}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
                            value={handle}
                            onChange={e => setHandle(e.target.value)}
                        />
                        <p className="text-[10px] text-slate-500">
                            {platform === "telegram"
                                ? "Enter the handle you used to create the event."
                                : "Enter the username of the linked Discord account."}
                        </p>
                    </div>

                    {error && <p className="text-red-400 text-sm bg-red-900/10 p-2 rounded border border-red-900/50">{error}</p>}

                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="flex-1 px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !handle}
                            className={`flex-1 px-4 py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center text-white ${platform === 'telegram' ? 'bg-sky-600 hover:bg-sky-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Send"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

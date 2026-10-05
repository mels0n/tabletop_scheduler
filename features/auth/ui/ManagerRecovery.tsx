"use client";

import { useState, useEffect } from "react";
import { recoverManagerLink } from "@/features/event-management/server/recovery";
import { recoverDiscordManagerLink } from "@/features/integrations/discord/server/actions";
import { Loader2, Lock, ShieldCheck } from "lucide-react";

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
                ? await recoverManagerLink(slug, handle, "telegram")
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
                className="text-xs text-mist hover:text-gold-bright transition-colors flex items-center gap-1 mx-auto mt-4"
            >
                <Lock className="w-3 h-3" />
                Lost Manager Link?
            </button>
        );
    }

    // State 2: Success Modal (Link Sent)
    if (successMsg) {
        return (
            <div className="fixed inset-0 bg-ink/85 flex items-center justify-center p-4 z-50">
                <div className="bg-surface border border-yes p-6 rounded-card max-w-sm w-full shadow-modal">
                    <div className="flex flex-col items-center text-center gap-4">
                        <div className="w-12 h-12 bg-yes-bg rounded-card flex items-center justify-center text-yes">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-lg text-yes">Recovery Sent!</h3>
                        <p className="text-parchment-2 text-sm">{successMsg}</p>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="btn-secondary w-full px-4 py-2"
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
        <div className="fixed inset-0 bg-ink/85 flex items-center justify-center p-4 z-[100]">
            <div className="bg-surface border border-line p-6 rounded-card max-w-sm w-full shadow-modal">
                <div className="flex items-center gap-2 mb-4 text-gold-bright">
                    <ShieldCheck className="w-6 h-6" />
                    <h3 className="font-bold text-lg">Recover Access</h3>
                </div>

                <p className="text-parchment-2 text-sm mb-4">
                    {platform === "telegram"
                        ? <>Enter the Telegram handle of the manager account linked to this event. If it matches, we send a <b>Magic Link</b> to that account&apos;s Telegram DMs. This only works if you linked your Telegram account as manager earlier.</>
                        : <>Enter the Discord Username linked to this event. We will verify it and send a <b>Magic Link</b> to your Discord DMs.</>
                    }
                </p>

                <form onSubmit={handleRecover} className="space-y-4">

                    {/* Platform Toggle */}
                    <div className="segmented p-1 gap-1">
                        <button
                            type="button"
                            onClick={() => setPlatform("telegram")}
                            className={`py-1.5 text-xs font-medium rounded-control transition-colors ${platform === "telegram" ? "is-active text-telegram" : "text-mist hover:text-parchment"}`}
                        >
                            Telegram
                        </button>
                        <button
                            type="button"
                            onClick={() => setPlatform("discord")}
                            className={`py-1.5 text-xs font-medium rounded-control transition-colors ${platform === "discord" ? "is-active text-discord" : "text-mist hover:text-parchment"}`}
                        >
                            Discord
                        </button>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-mist uppercase tracking-wide">
                            {platform === "telegram" ? "Telegram Handle" : "Discord Username"}
                        </label>
                        <input
                            type="text"
                            placeholder={platform === "telegram" ? "@YourHandle" : "username"}
                            className="field w-full px-4 py-2 text-sm"
                            value={handle}
                            onChange={e => setHandle(e.target.value)}
                        />
                        <p className="text-[10px] text-mist">
                            {platform === "telegram"
                                ? "Enter the handle of the linked manager account (with or without @)."
                                : "Enter the username of the linked Discord account (with or without @)."}
                        </p>
                    </div>

                    {error && <p className="text-no text-sm bg-no-bg p-2 rounded-control border border-no">{error}</p>}

                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="btn-secondary flex-1 px-4 py-2 text-sm font-normal"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !handle}
                            className={`flex-1 px-4 py-2 rounded-control font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center ${platform === 'telegram' ? 'bg-telegram hover:bg-telegram/90 text-ink' : 'bg-discord hover:bg-discord/90 text-white'}`}
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Send"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

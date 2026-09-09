"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2Off, RefreshCw, ShieldCheck } from "lucide-react";
import { unlinkPlatformEverywhere } from "@/features/auth/server/identity-unlink";

type Platform = 'telegram' | 'discord';

const PLATFORM_LABEL: Record<Platform, string> = {
    telegram: 'Telegram',
    discord: 'Discord',
};

/**
 * @component PlatformRow
 * @description One linked platform with its two-step unlink control. First click reveals
 * an inline warning (this is the destructive-action confirm: it removes the identity from
 * every participant record and every managed event, which kills that platform's magic-link
 * recovery); only the explicit "Yes, unlink" click calls the server action.
 */
function PlatformRow({ platform }: { platform: Platform }) {
    const router = useRouter();
    const [confirming, setConfirming] = useState(false);
    const [pending, setPending] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const label = PLATFORM_LABEL[platform];

    const handleConfirm = async () => {
        setPending(true);
        setMsg(null);
        const res = await unlinkPlatformEverywhere(platform);
        setPending(false);
        setConfirming(false);
        if ('error' in res) {
            setMsg({ type: 'error', text: res.error });
        } else {
            setMsg({ type: 'success', text: res.message });
            router.refresh();
        }
    };

    return (
        <div className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm font-medium text-slate-200">{label}</p>
                    <p className="text-xs text-slate-500">Linked on this browser</p>
                </div>
                {!confirming && (
                    <button
                        type="button"
                        onClick={() => { setMsg(null); setConfirming(true); }}
                        disabled={pending}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-rose-300 border border-rose-900/60 rounded-lg hover:bg-rose-950/40 hover:border-rose-800 disabled:opacity-50 transition-colors"
                    >
                        <Link2Off className="w-3.5 h-3.5" />
                        Unlink {label}
                    </button>
                )}
            </div>

            {confirming && (
                <div className="mt-3 p-4 bg-amber-950/20 border border-amber-900/50 rounded-lg space-y-3">
                    <p className="text-xs text-amber-200 leading-relaxed">
                        This removes your {label} identity from every event you voted on or manage,
                        deletes any pending login links, and signs this browser out of {label} sync.
                        You will lose {label} magic-link recovery for events you manage: if this
                        browser also loses its admin session, those events cannot be recovered
                        through {label}. You can re-link later, but manager access recovers only
                        while an admin session still exists somewhere.
                    </p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={pending}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-600 disabled:opacity-50 rounded-lg transition-colors"
                        >
                            {pending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />}
                            Yes, unlink {label}
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirming(false)}
                            disabled={pending}
                            className="px-3 py-1.5 text-xs font-medium text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {msg && (
                <p className={`text-xs mt-2 ${msg.type === 'success' ? 'text-green-400' : 'text-amber-400'}`}>
                    {msg.text}
                </p>
            )}
        </div>
    );
}

/**
 * @component LinkedAccountsPanel
 * @description "Linked Accounts" section for the Privacy & Data page: lists each platform
 * the browser is synced with and offers the account-level "unlink and delete my data"
 * action. This is the self-serve deletion path our privacy disclosures point at. When no
 * platform is linked it renders an explicit empty state (the panel now lives on its own
 * page, so returning nothing would leave that page blank).
 */
export function LinkedAccountsPanel({ isTelegramSynced, isDiscordSynced }: { isTelegramSynced?: boolean; isDiscordSynced?: boolean }) {
    return (
        <div className="pt-8 border-t border-slate-800">
            <h3 className="text-lg font-medium text-slate-200 mb-1 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                Linked Accounts
            </h3>
            <p className="text-xs text-slate-500 mb-4">
                Unlinking removes that platform&apos;s identity from all of your Tabletop Time data.
            </p>
            {(isTelegramSynced || isDiscordSynced) ? (
                <div className="bg-slate-900 border border-slate-700 rounded-xl px-6 py-3 divide-y divide-slate-800">
                    {isTelegramSynced && <PlatformRow platform="telegram" />}
                    {isDiscordSynced && <PlatformRow platform="discord" />}
                </div>
            ) : (
                <div className="text-center py-8 px-6 text-sm text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    No platforms are linked on this browser. Connect Telegram or Discord from your
                    profile page first, then manage or delete that data here.
                </div>
            )}
        </div>
    );
}

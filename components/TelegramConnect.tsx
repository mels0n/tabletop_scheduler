"use client";

import { useState, useEffect } from "react";
import { CopyLinkButton } from "./CopyLinkButton";
import { updateTelegramInviteLink, checkEventStatus } from "@/features/event-management/server/actions";
import { CheckCircle, Loader2, Save, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatHandle } from "@/shared/lib/handle";

interface TelegramConnectProps {
    slug: string;
    botUsername: string;
    initialTelegramLink?: string | null;
    hasChatId: boolean;
}

export function TelegramConnect({
    slug,
    botUsername,
    initialTelegramLink,
    hasChatId: initialHasChatId,
    initialHandle: propsInitialHandle,
    hasManagerChatId: initialHasManagerId
}: TelegramConnectProps & {
    initialHandle: string | null;
    hasManagerChatId: boolean;
}) {
    const router = useRouter();
    const [telegramLink, setTelegramLink] = useState(initialTelegramLink || "");
    const [hasChatId, setHasChatId] = useState(initialHasChatId);
    const [expanded, setExpanded] = useState(false);

    const [initialHandle, setInitialHandle] = useState(propsInitialHandle);
    const [hasManagerChatId, setHasManagerChatId] = useState(initialHasManagerId);
    const [dmLoading, setDmLoading] = useState(false);
    const [dmMessage, setDmMessage] = useState("");
    const [registerLoading, setRegisterLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");
    const [step, setStep] = useState<'initial' | 'bot_not_in_group' | 'bot_in_group' | 'link_saved'>('initial');
    const [isPolling, setIsPolling] = useState(false);

    useEffect(() => {
        if (!isPolling) return;
        if (hasChatId && hasManagerChatId) return;

        const interval = setInterval(async () => {
            try {
                if (!hasChatId) {
                    const status = await checkEventStatus(slug);
                    if (status.hasTelegramChatId) {
                        setHasChatId(true);
                        router.refresh();
                    }
                }
                if (!hasManagerChatId) {
                    const { checkManagerStatus } = await import("@/features/event-management/server/actions");
                    const status = await checkManagerStatus(slug);
                    if (status.hasManagerChatId) {
                        setHasManagerChatId(true);
                        if (status.handle) setInitialHandle(status.handle);
                        router.refresh();
                    }
                }
            } catch (e) { }
        }, 3000);

        return () => clearInterval(interval);
    }, [isPolling, hasChatId, hasManagerChatId, slug, router]);

    const handleSaveLink = async () => {
        if (!telegramLink) return;
        setIsSaving(true);
        setError("");
        try {
            const res = await updateTelegramInviteLink(slug, telegramLink);
            if (res.error) {
                setError(res.error);
            } else {
                setStep('link_saved');
                router.refresh();
            }
        } catch (e) {
            setError("Failed to save link.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDM = async () => {
        if (!hasManagerChatId) return;
        setDmLoading(true);
        setDmMessage("");
        setError("");
        try {
            const { dmManagerLink } = await import("@/features/event-management/server/recovery");
            const res = await dmManagerLink(slug);
            if (res.error) {
                setError(res.error);
            } else {
                setDmMessage("Link sent. Check your Telegram DMs.");
            }
        } catch (e) {
            setError("Failed to send request.");
        } finally {
            setDmLoading(false);
        }
    };

    // Compact connected state
    if (hasChatId) {
        return (
            <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="flex items-center gap-2.5">
                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                        <span className="text-sm font-medium text-slate-200">Telegram</span>
                        <span className="text-xs text-green-400">connected</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {initialHandle && (
                            <span className="text-xs text-slate-500 font-mono">{formatHandle(initialHandle)}</span>
                        )}
                        <button
                            onClick={() => setExpanded(e => !e)}
                            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            {expanded ? 'hide' : 'manage →'}
                        </button>
                    </div>
                </div>

                {expanded && (
                    <div className="mt-1 p-3 bg-slate-900/40 rounded-lg border border-slate-800 space-y-3">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Manager Recovery</p>
                        {!hasManagerChatId ? (
                            <div className="space-y-2">
                                <p className="text-xs text-slate-400">
                                    Register to receive magic login links via DM if you lose browser access.
                                </p>
                                <button
                                    onClick={async () => {
                                        setRegisterLoading(true);
                                        try {
                                            const { generateShortRecoveryToken } = await import("@/features/event-management/server/recovery");
                                            const res = await generateShortRecoveryToken(slug);
                                            if (res.token) {
                                                window.open(`https://t.me/${botUsername}?start=rec_${res.token}`, '_blank');
                                                setIsPolling(true);
                                            }
                                        } catch (e) { } finally { setRegisterLoading(false); }
                                    }}
                                    disabled={registerLoading}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 w-full py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-slate-700"
                                >
                                    {registerLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                    Register for Magic Links
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs text-green-400">
                                    <CheckIcon className="w-3 h-3 shrink-0" />
                                    <span>Identity verified</span>
                                    {initialHandle && (
                                        <span className="ml-auto font-mono opacity-60">{formatHandle(initialHandle)}</span>
                                    )}
                                </div>
                                {dmMessage && <p className="text-green-400 text-xs">{dmMessage}</p>}
                                <button
                                    onClick={handleDM}
                                    disabled={dmLoading}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 w-full py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-slate-700"
                                >
                                    {dmLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Send Magic Link (Telegram DM)"}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // Setup state — group not yet connected
    return (
        <div className="space-y-4">
            <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-xl space-y-4">
                <div className="flex items-start gap-3 text-blue-300">
                    <Send className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className="font-bold">Connect Telegram Group</p>
                        <p className="opacity-90 text-xs text-blue-400">
                            Get notifications and manage votes in your group chat.
                        </p>
                    </div>
                </div>

                {step === 'initial' && (
                    <div className="space-y-3">
                        <p className="text-sm text-slate-300">
                            Is <b>@{botUsername}</b> already in the Telegram group?
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setStep('bot_in_group'); setIsPolling(true); }}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors"
                            >
                                Yes, it is
                            </button>
                            <button
                                onClick={() => setStep(telegramLink ? 'link_saved' : 'bot_not_in_group')}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                No, not yet
                            </button>
                        </div>
                    </div>
                )}

                {step === 'bot_in_group' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                        <p className="text-xs text-slate-400">1. Copy this specific event link:</p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 bg-black/30 p-2 rounded text-xs font-mono text-slate-300 truncate">
                                {typeof window !== 'undefined' ? `${window.location.host}/e/${slug}` : `/e/${slug}`}
                            </code>
                            <CopyLinkButton url={`/e/${slug}`} />
                        </div>
                        <p className="text-xs text-slate-400">
                            2. <b>Paste it into your Telegram group</b> to finish connecting.
                        </p>
                        <button onClick={() => setStep('initial')} className="text-xs text-slate-500 hover:text-slate-300 underline">
                            Start Over
                        </button>
                    </div>
                )}

                {step === 'bot_not_in_group' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2">
                            <label className="text-sm text-slate-300 font-medium">
                                First, what is the Group Invite Link?
                            </label>
                            <p className="text-xs text-slate-500 italic pb-1">
                                Desktop: ⋮ {'>'} Manage Group {'>'} Invite Links {'>'} Copy Link
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="url"
                                    placeholder="https://t.me/..."
                                    value={telegramLink}
                                    onChange={(e) => setTelegramLink(e.target.value)}
                                    className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                                />
                                <button
                                    onClick={handleSaveLink}
                                    disabled={isSaving || !telegramLink.startsWith('https://t.me/')}
                                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Save
                                </button>
                            </div>
                            {error && <p className="text-red-400 text-xs">{error}</p>}
                        </div>
                        <button onClick={() => setStep('initial')} className="text-xs text-slate-500 hover:text-slate-300 underline">
                            Back
                        </button>
                    </div>
                )}

                {step === 'link_saved' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <p className="text-sm text-slate-300">
                            Perfect. Now click below to add the bot to your group.
                        </p>
                        <a
                            href={`https://t.me/${botUsername}?startgroup=${slug}&admin=change_info+pin_messages`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                        >
                            <Send className="w-4 h-4" />
                            <span>Add @{botUsername} to Group</span>
                        </a>
                    </div>
                )}
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                <h3 className="font-semibold text-slate-300 text-sm flex items-center gap-2">
                    <span className="text-lg">🔐</span>
                    Telegram Manager Recovery
                </h3>
                {!hasManagerChatId ? (
                    <div className="space-y-3">
                        <p className="text-xs text-slate-400">
                            Register to receive magic login links via DM if you lose access to this browser.
                        </p>
                        <button
                            onClick={async () => {
                                setRegisterLoading(true);
                                try {
                                    const { generateShortRecoveryToken } = await import("@/features/event-management/server/recovery");
                                    const res = await generateShortRecoveryToken(slug);
                                    if (res.token) {
                                        window.open(`https://t.me/${botUsername}?start=rec_${res.token}`, '_blank');
                                        setIsPolling(true);
                                    }
                                } catch (e) { } finally { setRegisterLoading(false); }
                            }}
                            disabled={registerLoading}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 w-full py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-slate-700"
                        >
                            {registerLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                            Register for Magic Links
                        </button>
                        <p className="text-[10px] text-slate-500 text-center">(Opens Telegram to verify you)</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs text-green-400 bg-green-900/10 px-3 py-2 rounded border border-green-900/30">
                            <CheckIcon className="w-3 h-3 shrink-0" />
                            <span className="font-medium">Identity Verified</span>
                            {initialHandle && <span className="ml-auto font-mono opacity-70">{formatHandle(initialHandle)}</span>}
                        </div>
                        {dmMessage && <p className="text-green-400 text-xs font-medium text-center">{dmMessage}</p>}
                        <button
                            onClick={handleDM}
                            disabled={dmLoading}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 w-full py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-slate-700"
                        >
                            {dmLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Send Magic Link (Telegram DM)"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function CheckIcon({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12" /></svg>;
}

"use client";

import { useState, useEffect } from "react";
import { updateTelegramInviteLink, checkEventStatus } from "@/features/event-management/server/actions";
import { Check, CheckCircle, Copy, Loader2, Lock, Save, Send } from "lucide-react";
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

        async function checkOnce(): Promise<void> {
            if (document.visibilityState === "hidden") return;
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
            } catch { /* polling is best-effort; retry on next tick */ }
        }

        const interval = setInterval(checkOnce, 3000);
        // A hidden tab skips its ticks; check right away when it comes back.
        const onVisibility = () => { void checkOnce(); };
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibility);
        };
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

    // The `/connect <slug> <code>` command is admin-only, so it is fetched on demand rather
    // than rendered into the page for everyone.
    const [connectCommand, setConnectCommand] = useState<string | null>(null);
    const [connectCommandError, setConnectCommandError] = useState("");
    const needsConnectCommand = !hasChatId && (step === 'bot_in_group' || step === 'link_saved');

    useEffect(() => {
        if (!needsConnectCommand || connectCommand) return;
        let cancelled = false;
        (async () => {
            const { connectCommandForAdmin } = await import("@/features/event-management/server/recovery");
            const res = await connectCommandForAdmin(slug);
            if (cancelled) return;
            if (res.success) {
                setConnectCommand(res.command);
                setConnectCommandError("");
            } else {
                setConnectCommandError(res.error || "Could not load the connect command.");
            }
        })().catch(() => {
            if (!cancelled) setConnectCommandError("Could not load the connect command.");
        });
        return () => { cancelled = true; };
    }, [needsConnectCommand, connectCommand, slug]);

    const handleRegister = async () => {
        setRegisterLoading(true);
        setError("");
        try {
            const { startTelegramRecovery } = await import("@/features/event-management/server/recovery");
            const res = await startTelegramRecovery(slug);
            if (res.success) {
                window.open(`https://t.me/${botUsername}?start=rec_${res.token}`, '_blank');
                setIsPolling(true);
            } else {
                setError(res.error || "Failed to generate token");
            }
        } catch { /* best-effort: the button re-enables so the user can retry */ } finally { setRegisterLoading(false); }
    };

    const handleDM = async () => {
        if (!hasManagerChatId) return;
        setDmLoading(true);
        setDmMessage("");
        setError("");
        try {
            const { dmManagerLink } = await import("@/features/event-management/server/recovery");
            const res = await dmManagerLink(slug, "telegram");
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
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-control bg-surface border border-line">
                    <div className="flex items-center gap-2.5">
                        <CheckCircle className="w-4 h-4 text-yes shrink-0" />
                        <span className="text-sm font-medium text-parchment">Telegram</span>
                        <span className="text-xs text-yes">connected</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {initialHandle && (
                            <span className="text-xs text-mist font-mono">{formatHandle(initialHandle)}</span>
                        )}
                        <button
                            onClick={() => setExpanded(e => !e)}
                            className="text-xs text-mist hover:text-parchment-2 transition-colors"
                        >
                            {expanded ? 'hide' : 'manage →'}
                        </button>
                    </div>
                </div>

                {expanded && (
                    <div className="mt-1 p-3 bg-surface rounded-control border border-line space-y-3">
                        <p className="text-xs font-semibold text-mist uppercase tracking-widest">Manager Recovery</p>
                        {!hasManagerChatId ? (
                            <div className="space-y-2">
                                <p className="text-xs text-mist">
                                    Register to receive magic login links via DM if you lose browser access.
                                </p>
                                <button
                                    onClick={handleRegister}
                                    disabled={registerLoading}
                                    className="hover:bg-surface-2 text-parchment-2 w-full py-2 rounded-control text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-line-strong"
                                >
                                    {registerLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                    Register for Magic Links
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs text-yes">
                                    <CheckIcon className="w-3 h-3 shrink-0" />
                                    <span>Identity verified</span>
                                    {initialHandle && (
                                        <span className="ml-auto font-mono">{formatHandle(initialHandle)}</span>
                                    )}
                                </div>
                                {dmMessage && <p className="text-yes text-xs">{dmMessage}</p>}
                                <button
                                    onClick={handleDM}
                                    disabled={dmLoading}
                                    className="hover:bg-surface-2 text-parchment-2 w-full py-2 rounded-control text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-line-strong"
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
            <div className="p-4 bg-surface-2 border border-line-strong rounded-card space-y-4">
                <div className="flex items-start gap-3 text-gold-bright">
                    <Send className="w-5 h-5 flex-shrink-0 mt-0.5 text-telegram" aria-hidden="true" />
                    <div className="space-y-1">
                        <p className="font-bold">Connect Telegram Group</p>
                        <p className="opacity-90 text-xs text-gold-bright">
                            Get notifications and manage votes in your group chat.
                        </p>
                    </div>
                </div>

                {step === 'initial' && (
                    <div className="space-y-3">
                        <p className="text-sm text-parchment-2">
                            Is <b>@{botUsername}</b> already in the Telegram group?
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setStep('bot_in_group'); setIsPolling(true); }}
                                className="px-4 py-2 border border-line-strong hover:bg-surface text-parchment rounded-control text-sm font-medium transition-colors"
                            >
                                Yes, it is
                            </button>
                            <button
                                onClick={() => setStep(telegramLink ? 'link_saved' : 'bot_not_in_group')}
                                className="px-4 py-2 bg-gold hover:bg-gold-bright text-on-gold rounded-control text-sm font-medium transition-colors"
                            >
                                No, not yet
                            </button>
                        </div>
                    </div>
                )}

                {step === 'bot_in_group' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                        <p className="text-xs text-mist">1. Copy this connect command:</p>
                        <ConnectCommand command={connectCommand} error={connectCommandError} />
                        <p className="text-xs text-mist">
                            2. <b>Send it in your Telegram group</b> to finish connecting.
                        </p>
                        <button onClick={() => setStep('initial')} className="text-xs text-mist hover:text-parchment-2 underline">
                            Start Over
                        </button>
                    </div>
                )}

                {step === 'bot_not_in_group' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2">
                            <label className="text-sm text-parchment-2 font-medium">
                                First, what is the Group Invite Link?
                            </label>
                            <p className="text-xs text-mist italic pb-1">
                                Desktop: ⋮ {'>'} Manage Group {'>'} Invite Links {'>'} Copy Link
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="url"
                                    placeholder="https://t.me/..."
                                    value={telegramLink}
                                    onChange={(e) => setTelegramLink(e.target.value)}
                                    className="flex-1 bg-field border border-line-strong rounded-control px-3 py-2 text-sm text-parchment placeholder:text-mist focus:border-gold"
                                />
                                <button
                                    onClick={handleSaveLink}
                                    disabled={isSaving || !telegramLink.startsWith('https://t.me/')}
                                    className="bg-gold hover:bg-gold-bright disabled:opacity-50 disabled:cursor-not-allowed text-on-gold px-4 py-2 rounded-control text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Save
                                </button>
                            </div>
                            {error && <p className="text-no text-xs">{error}</p>}
                        </div>
                        <button onClick={() => setStep('initial')} className="text-xs text-mist hover:text-parchment-2 underline">
                            Back
                        </button>
                    </div>
                )}

                {step === 'link_saved' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <p className="text-sm text-parchment-2">
                            Perfect. Now click below to add the bot to your group.
                        </p>
                        <a
                            href={`https://t.me/${botUsername}?startgroup=${slug}&admin=change_info+pin_messages`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2 rounded-control text-sm bg-gold hover:bg-gold-bright text-on-gold font-medium transition-colors flex items-center justify-center gap-2 "
                        >
                            <Send className="w-4 h-4" />
                            <span>Add @{botUsername} to Group</span>
                        </a>
                        <p className="text-xs text-mist">
                            Then send this command in the group to finish connecting:
                        </p>
                        <ConnectCommand command={connectCommand} error={connectCommandError} />
                    </div>
                )}
            </div>

            <div className="p-4 bg-surface border border-line rounded-card space-y-4">
                <h3 className="font-semibold text-parchment-2 text-sm flex items-center gap-2">
                    <Lock className="size-4 text-gold-bright" aria-hidden="true" />
                    Telegram Manager Recovery
                </h3>
                {!hasManagerChatId ? (
                    <div className="space-y-3">
                        <p className="text-xs text-mist">
                            Register to receive magic login links via DM if you lose access to this browser.
                        </p>
                        <button
                            onClick={handleRegister}
                            disabled={registerLoading}
                            className="hover:bg-surface-2 text-parchment-2 w-full py-2 rounded-control text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-line-strong"
                        >
                            {registerLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                            Register for Magic Links
                        </button>
                        <p className="text-xs text-mist text-center">(Opens Telegram to verify you)</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs text-yes bg-yes-bg px-3 py-2 rounded-control border border-yes">
                            <CheckIcon className="w-3 h-3 shrink-0" />
                            <span className="font-medium">Identity Verified</span>
                            {initialHandle && <span className="ml-auto font-mono">{formatHandle(initialHandle)}</span>}
                        </div>
                        {dmMessage && <p className="text-yes text-xs font-medium text-center">{dmMessage}</p>}
                        <button
                            onClick={handleDM}
                            disabled={dmLoading}
                            className="hover:bg-surface-2 text-parchment-2 w-full py-2 rounded-control text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-line-strong"
                        >
                            {dmLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Send Magic Link (Telegram DM)"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function ConnectCommand({ command, error }: { command: string | null; error: string }) {
    const [copied, setCopied] = useState(false);

    if (error) return <p className="text-no text-xs">{error}</p>;
    if (!command) {
        return (
            <div className="flex items-center gap-2 text-xs text-mist">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading command...
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <code className="flex-1 bg-field p-2 rounded-control text-xs font-mono text-parchment-2 truncate">{command}</code>
            <button
                onClick={() => {
                    navigator.clipboard.writeText(command);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                }}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-2 rounded-control text-xs font-medium text-parchment-2 transition-colors border border-line-strong"
            >
                {copied ? <Check className="w-3 h-3 text-yes" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied!" : "Copy"}
            </button>
        </div>
    );
}

function CheckIcon({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12" /></svg>;
}

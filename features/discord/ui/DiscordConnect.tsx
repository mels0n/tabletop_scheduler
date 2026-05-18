"use strict";
"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { listDiscordChannels, connectDiscordChannel } from "@/features/integrations/discord/server/actions";
import { checkEventStatus } from "@/features/event-management/server/actions";
import { AlertCircle, CheckCircle, Loader2, Save } from "lucide-react";

function CheckIcon({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12" /></svg>;
}

const DiscordIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 127 96" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22c.63-23.28-18.68-47.5-35.3-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,54,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.23,53,91.1,65.69,84.69,65.69Z" />
    </svg>
);

interface DiscordConnectProps {
    slug: string;
    hasChannel: boolean;
    guildId?: string | null;
    channelId?: string | null;
    hasManagerDiscordId: boolean;
}

export function DiscordConnect({ slug, hasChannel: initialHasChannel, guildId: initialGuildId, channelId: initialChannelId, hasManagerDiscordId }: DiscordConnectProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [hasChannel, setHasChannel] = useState(initialHasChannel);
    const [savedChannelId, setSavedChannelId] = useState(initialChannelId);
    const [expanded, setExpanded] = useState(false);

    const [channels, setChannels] = useState<{ id: string, name: string }[]>([]);
    const [selectedChannel, setSelectedChannel] = useState(initialChannelId || "");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [dmLoading, setDmLoading] = useState(false);
    const [dmMessage, setDmMessage] = useState("");
    const [channelName, setChannelName] = useState<string>("");

    const discordConnected = searchParams.get("discord_connected") === "true";
    const newGuildId = searchParams.get("guild_id");
    const [step, setStep] = useState<'initial' | 'picking_channel' | 'saving'>('initial');

    useEffect(() => {
        if (discordConnected && newGuildId) {
            setStep('picking_channel');
            fetchChannels(newGuildId);
        } else if (initialGuildId && !hasChannel) {
            setStep('picking_channel');
            fetchChannels(initialGuildId);
        }
    }, [discordConnected, newGuildId, initialGuildId, hasChannel]);

    useEffect(() => {
        const gId = initialGuildId || newGuildId;
        if (hasChannel && gId && !channelName) {
            listDiscordChannels(gId).then((res) => {
                if (res.channels) {
                    const found = res.channels.find((c: { id: string, name: string }) => c.id === savedChannelId);
                    if (found) setChannelName(found.name);
                }
            });
        }
    }, [hasChannel, initialGuildId, newGuildId, savedChannelId, channelName]);

    async function fetchChannels(gId: string) {
        setLoading(true);
        setError("");
        const res = await listDiscordChannels(gId);
        if (res.error) {
            setError(res.error);
        } else if (res.channels) {
            setChannels(res.channels);
        }
        setLoading(false);
    }

    async function handleSave() {
        if (!selectedChannel) return;
        setLoading(true);
        setError("");
        const gId = newGuildId || initialGuildId;
        if (!gId) {
            setError("Missing Guild ID. Please reconnect.");
            setLoading(false);
            return;
        }
        const res = await connectDiscordChannel(slug, gId, selectedChannel);
        setLoading(false);
        if (res.error) {
            setError(res.error);
        } else {
            setHasChannel(true);
            setSavedChannelId(selectedChannel);
            router.replace(pathname);
            router.refresh();
        }
    }

    async function handleDM() {
        if (!hasManagerDiscordId) return;
        setDmLoading(true);
        setDmMessage("");
        try {
            const { dmDiscordManagerLink } = await import("@/features/integrations/discord/server/actions");
            const res = await dmDiscordManagerLink(slug);
            if (res.error) {
                setDmMessage(`Failed: ${res.error}`);
            } else {
                setDmMessage("Link sent. Check your Discord DMs.");
            }
        } catch (e) {
            setDmMessage("Failed to send.");
        } finally {
            setDmLoading(false);
        }
    }

    // Compact connected state
    if (hasChannel) {
        return (
            <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="flex items-center gap-2.5">
                        <CheckCircle className="w-4 h-4 text-[#5865F2] shrink-0" />
                        <span className="text-sm font-medium text-slate-200">Discord</span>
                        <span className="text-xs text-[#5865F2]">connected</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {channelName && (
                            <span className="text-xs text-slate-500 font-mono">#{channelName}</span>
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
                    <div className="ml-3 pl-3 border-l border-slate-800 py-2 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Manager Recovery</p>
                            <button
                                onClick={() => { setHasChannel(false); setStep('initial'); setExpanded(false); }}
                                className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                            >
                                reconnect channel
                            </button>
                        </div>
                        {hasManagerDiscordId ? (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs text-[#5865F2]">
                                    <CheckIcon className="w-3 h-3 shrink-0" />
                                    <span>Identity verified</span>
                                </div>
                                {dmMessage && <p className="text-xs text-slate-300">{dmMessage}</p>}
                                <button
                                    onClick={handleDM}
                                    disabled={dmLoading}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 w-full py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-slate-700"
                                >
                                    {dmLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Send Magic Link (Discord DM)"}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-xs text-slate-400">
                                    Associate your Discord account to recover managing rights if you lose access.
                                </p>
                                <a
                                    href={`/api/auth/discord?flow=login&returnTo=/e/${slug}/manage`}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 w-full py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-slate-700"
                                >
                                    <DiscordIcon className="w-3 h-3" />
                                    Recover with Discord
                                </a>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // Setup state — channel not yet connected
    return (
        <div className="space-y-4">
            <div className="p-4 bg-indigo-900/10 border border-indigo-800/50 rounded-xl space-y-4">
                <div className="flex items-start gap-3 text-indigo-300">
                    <div className="p-2 bg-indigo-500/10 rounded-lg shrink-0">
                        <DiscordIcon className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                        <p className="font-bold">Connect Discord Notifications</p>
                        <p className="opacity-90 text-xs text-slate-400">
                            {step === 'initial' && "Invite the bot to your server to start."}
                            {step === 'picking_channel' && "Select the channel for event updates."}
                        </p>
                    </div>
                </div>

                {error === "MISSING_PERMISSIONS" ? (
                    <div className="p-3 bg-amber-900/20 border border-amber-900/50 rounded-lg space-y-3">
                        <div className="flex items-start gap-2 text-amber-200">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-sm">Action Required: Permissions</p>
                                <p className="text-xs opacity-90 mt-1">Found the channel, but the bot is not allowed to post in it.</p>
                            </div>
                        </div>
                        <ol className="text-xs text-amber-100/80 list-decimal ml-8 space-y-1">
                            <li>Go to <b>Discord Channel Settings</b></li>
                            <li>Click <b>Permissions</b></li>
                            <li>Add <b>{process.env.NEXT_PUBLIC_BOT_NAME || "the Bot"}</b></li>
                            <li>Grant: <b className="text-white">View Channel</b> & <b className="text-white">Send Messages</b></li>
                        </ol>
                        <button onClick={handleSave} className="w-full py-2 bg-amber-700 hover:bg-amber-600 text-white rounded text-xs font-bold transition-colors">
                            I Fixed It - Try Again
                        </button>
                    </div>
                ) : error && (
                    <div className="p-2 bg-red-900/20 border border-red-900/50 rounded text-xs text-red-300 flex items-center gap-2">
                        <AlertCircle className="w-3 h-3" />
                        {error}
                    </div>
                )}

                {step === 'initial' && (
                    <div className="pl-12">
                        <a
                            href={`/api/auth/discord?flow=connect&returnTo=${encodeURIComponent(pathname)}`}
                            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-900/20"
                        >
                            Connect Discord Server
                        </a>
                    </div>
                )}

                {step === 'picking_channel' && (
                    <div className="pl-12 space-y-3 animate-in fade-in slide-in-from-top-2">
                        {loading && channels.length === 0 ? (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Fetching channels...
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <select
                                    value={selectedChannel}
                                    onChange={(e) => setSelectedChannel(e.target.value)}
                                    className="flex-1 bg-slate-950 border border-indigo-500/30 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="">Select a Channel...</option>
                                    {channels.map(c => (
                                        <option key={c.id} value={c.id}>#{c.name}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleSave}
                                    disabled={!selectedChannel || loading}
                                    className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Save
                                </button>
                            </div>
                        )}
                        <p className="text-[10px] text-slate-500">
                            Bot not showing up? <a href="/api/auth/discord?flow=connect" className="text-indigo-400 hover:underline">Re-invite it</a>.
                        </p>
                    </div>
                )}
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                <h3 className="font-semibold text-slate-300 text-sm flex items-center gap-2">
                    <span className="text-lg">🔐</span>
                    Discord Manager Recovery
                </h3>
                {hasManagerDiscordId ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs text-[#5865F2] bg-[#5865F2]/10 px-3 py-2 rounded border border-[#5865F2]/30">
                            <CheckIcon className="w-3 h-3 shrink-0" />
                            <span className="font-medium">Identity Verified</span>
                        </div>
                        {dmMessage && <p className="text-xs font-medium text-center text-slate-300">{dmMessage}</p>}
                        <button
                            onClick={handleDM}
                            disabled={dmLoading}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 w-full py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-slate-700"
                        >
                            {dmLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Send Magic Link (Discord DM)"}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-xs text-slate-400">
                            Associate your Discord account to recover managing rights if you lose access.
                        </p>
                        <a
                            href={`/api/auth/discord?flow=login&returnTo=/e/${slug}/manage`}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 w-full py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-slate-700"
                        >
                            <DiscordIcon className="w-3 h-3" />
                            Recover with Discord (Magic Link)
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}

"use strict";
"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { listDiscordChannels, connectDiscordChannel } from "@/features/integrations/discord/server/actions";
import { AlertCircle, CheckCircle, Loader2, Lock, Save } from "lucide-react";
import { publicConfig } from "@/shared/config/public";

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
    /**
     * Discord OAuth is configured on the server. Without it the connect, re-invite and
     * recover links are hidden, since each one starts the OAuth flow.
     */
    oauthEnabled: boolean;
}

export function DiscordConnect({ slug, hasChannel: initialHasChannel, guildId: initialGuildId, channelId: initialChannelId, hasManagerDiscordId, oauthEnabled }: DiscordConnectProps) {
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
        // Both ways into the channel picker follow the OAuth bot-add flow.
        if (!oauthEnabled) return;
        if (discordConnected && newGuildId) {
            setStep('picking_channel');
            fetchChannels(slug, newGuildId);
        } else if (initialGuildId && !hasChannel) {
            setStep('picking_channel');
            fetchChannels(slug, initialGuildId);
        }
    }, [slug, discordConnected, newGuildId, initialGuildId, hasChannel, oauthEnabled]);

    useEffect(() => {
        const gId = initialGuildId || newGuildId;
        if (hasChannel && gId && !channelName) {
            listDiscordChannels(slug, gId).then((res) => {
                if (res.channels) {
                    const found = res.channels.find((c: { id: string, name: string }) => c.id === savedChannelId);
                    if (found) setChannelName(found.name);
                }
            });
        }
    }, [slug, hasChannel, initialGuildId, newGuildId, savedChannelId, channelName]);

    async function fetchChannels(eventSlug: string, gId: string) {
        setLoading(true);
        setError("");
        const res = await listDiscordChannels(eventSlug, gId);
        if ("code" in res && res.code === "forbidden") {
            // The one-hour grant from adding the bot has lapsed (or this browser is not the
            // admin): start the connect flow again rather than showing an empty picker.
            setStep('initial');
            setError(res.error);
        } else if (res.error) {
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

    // Every setup and recover link starts the OAuth flow. Without it there is nothing to show
    // unless a channel is bound or the manager's Discord account is linked (DM recovery needs
    // only the bot).
    if (!oauthEnabled && !hasChannel && !hasManagerDiscordId) return null;

    // Compact connected state
    if (hasChannel) {
        return (
            <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-control bg-surface border border-line">
                    <div className="flex items-center gap-2.5">
                        <CheckCircle className="w-4 h-4 text-discord shrink-0" />
                        <span className="text-sm font-medium text-parchment">Discord</span>
                        <span className="text-xs text-parchment-2">connected</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {channelName && (
                            <span className="text-xs text-mist font-mono">#{channelName}</span>
                        )}
                        {/* Without OAuth and a linked manager the panel would be empty. */}
                        {(oauthEnabled || hasManagerDiscordId) && (
                            <button
                                onClick={() => setExpanded(e => !e)}
                                className="text-xs text-mist hover:text-parchment-2 transition-colors"
                            >
                                {expanded ? 'hide' : 'manage →'}
                            </button>
                        )}
                    </div>
                </div>

                {expanded && (
                    <div className="mt-1 p-3 bg-surface rounded-control border border-line space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-mist uppercase tracking-widest">Manager Recovery</p>
                            {oauthEnabled && (
                                <button
                                    onClick={() => { setHasChannel(false); setStep('initial'); setExpanded(false); }}
                                    className="text-xs text-mist hover:text-parchment-2 transition-colors"
                                >
                                    reconnect channel
                                </button>
                            )}
                        </div>
                        {hasManagerDiscordId ? (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs text-parchment-2">
                                    <CheckIcon className="w-3 h-3 shrink-0 text-discord" />
                                    <span>Identity verified</span>
                                </div>
                                {dmMessage && <p className="text-xs text-parchment-2">{dmMessage}</p>}
                                <button
                                    onClick={handleDM}
                                    disabled={dmLoading}
                                    className="hover:bg-surface-2 text-parchment-2 w-full py-2 rounded-control text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-line-strong"
                                >
                                    {dmLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Send Magic Link (Discord DM)"}
                                </button>
                            </div>
                        ) : oauthEnabled ? (
                            <div className="space-y-2">
                                <p className="text-xs text-mist">
                                    Associate your Discord account to recover managing rights if you lose access.
                                </p>
                                <a
                                    href={`/api/auth/discord?flow=login&returnTo=/e/${slug}/manage`}
                                    className="hover:bg-surface-2 text-parchment-2 w-full py-2 rounded-control text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-line-strong"
                                >
                                    <DiscordIcon className="w-3 h-3" />
                                    Recover with Discord
                                </a>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        );
    }

    // Setup state — channel not yet connected
    return (
        <div className="space-y-4">
            {oauthEnabled && (
                <div className="p-4 bg-surface-2 border border-line-strong rounded-card space-y-4">
                    <div className="flex items-start gap-3 text-gold-bright">
                        <div className="p-2 bg-discord text-parchment rounded-control shrink-0">
                            <DiscordIcon className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                            <p className="font-bold">Connect Discord Notifications</p>
                            <p className="opacity-90 text-xs text-mist">
                                {step === 'initial' && "Invite the bot to your server to start."}
                                {step === 'picking_channel' && "Select the channel for event updates."}
                            </p>
                        </div>
                    </div>

                    {error === "MISSING_PERMISSIONS" ? (
                        <div className="p-3 bg-maybe-bg border border-maybe rounded-control space-y-3">
                            <div className="flex items-start gap-2 text-maybe">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-sm">Action Required: Permissions</p>
                                    <p className="text-xs opacity-90 mt-1">Found the channel, but the bot is not allowed to post in it.</p>
                                </div>
                            </div>
                            <ol className="text-xs text-maybe list-decimal ml-8 space-y-1">
                                <li>Go to <b>Discord Channel Settings</b></li>
                                <li>Click <b>Permissions</b></li>
                                <li>Add <b>{publicConfig.botName || "the Bot"}</b></li>
                                <li>Grant: <b className="text-parchment">View Channel</b> & <b className="text-parchment">Send Messages</b></li>
                            </ol>
                            <button onClick={handleSave} className="w-full py-2 bg-maybe hover:bg-maybe/90 text-on-maybe rounded-control text-xs font-bold transition-colors">
                                I Fixed It - Try Again
                            </button>
                        </div>
                    ) : error && (
                        <div className="p-2 bg-no-bg border border-no rounded-control text-xs text-no flex items-center gap-2">
                            <AlertCircle className="w-3 h-3" />
                            {error}
                        </div>
                    )}

                    {step === 'initial' && (
                        <a
                            href={`/api/auth/discord?flow=connect&returnTo=${encodeURIComponent(pathname)}`}
                            className="inline-flex items-center gap-2 bg-gold hover:bg-gold-bright text-on-gold px-4 py-2 rounded-control text-sm font-medium transition-colors "
                        >
                            Connect Discord Server
                        </a>
                    )}

                    {step === 'picking_channel' && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                            {loading && channels.length === 0 ? (
                                <div className="flex items-center gap-2 text-xs text-mist">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Fetching channels...
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <select
                                        value={selectedChannel}
                                        onChange={(e) => setSelectedChannel(e.target.value)}
                                        className="flex-1 bg-field border border-line-strong rounded-control px-3 py-2 text-sm text-parchment"
                                    >
                                        <option value="">Select a Channel...</option>
                                        {channels.map(c => (
                                            <option key={c.id} value={c.id}>#{c.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleSave}
                                        disabled={!selectedChannel || loading}
                                        className="bg-yes hover:bg-yes/90 disabled:opacity-50 disabled:cursor-not-allowed text-on-yes px-4 py-2 rounded-control text-sm font-medium transition-colors flex items-center gap-2"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        Save
                                    </button>
                                </div>
                            )}
                            <p className="text-xs text-mist">
                                Bot not showing up? <a href={`/api/auth/discord?flow=connect&returnTo=${encodeURIComponent(pathname)}`} className="text-gold-bright hover:underline">Re-invite it</a>.
                            </p>
                        </div>
                    )}
                </div>
            )}

            <div className="p-4 bg-surface border border-line rounded-card space-y-4">
                <h3 className="font-semibold text-parchment-2 text-sm flex items-center gap-2">
                    <Lock className="size-4 text-gold-bright" aria-hidden="true" />
                    Discord Manager Recovery
                </h3>
                {hasManagerDiscordId ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs text-parchment-2 bg-discord/10 px-3 py-2 rounded-control border border-discord/40">
                            <CheckIcon className="w-3 h-3 shrink-0 text-discord" />
                            <span className="font-medium">Identity Verified</span>
                        </div>
                        {dmMessage && <p className="text-xs font-medium text-center text-parchment-2">{dmMessage}</p>}
                        <button
                            onClick={handleDM}
                            disabled={dmLoading}
                            className="hover:bg-surface-2 text-parchment-2 w-full py-2 rounded-control text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-line-strong"
                        >
                            {dmLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Send Magic Link (Discord DM)"}
                        </button>
                    </div>
                ) : oauthEnabled ? (
                    <div className="space-y-3">
                        <p className="text-xs text-mist">
                            Associate your Discord account to recover managing rights if you lose access.
                        </p>
                        <a
                            href={`/api/auth/discord?flow=login&returnTo=/e/${slug}/manage`}
                            className="hover:bg-surface-2 text-parchment-2 w-full py-2 rounded-control text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-line-strong"
                        >
                            <DiscordIcon className="w-3 h-3" />
                            Recover with Discord (Magic Link)
                        </a>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

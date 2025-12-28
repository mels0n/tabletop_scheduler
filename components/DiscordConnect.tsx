"use strict";
"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { listDiscordChannels, connectDiscordChannel, checkEventStatus } from "@/app/actions";
import { AlertCircle, CheckCircle, Loader2, Save, Send, LogOut } from "lucide-react";

/**
 * @interface DiscordConnectProps
 * @description Props for the DiscordConnect component.
 * @property {string} slug - The event slug.
 * @property {boolean} hasChannel - Whether the event is already connected to a channel.
 * @property {string | null} [guildId] - The ID of the connected Discord Guild.
 * @property {string | null} [channelId] - The ID of the connected Discord Channel.
 */
interface DiscordConnectProps {
    slug: string;
    hasChannel: boolean;
    guildId?: string | null;
    channelId?: string | null;
}

/**
 * @component DiscordConnect
 * @description A wizard-style component for connecting a Discord Bot to the event.
 * Handles the OAuth flow initiation, channel fetching, and selection saving.
 */
export function DiscordConnect({ slug, hasChannel: initialHasChannel, guildId: initialGuildId, channelId: initialChannelId }: DiscordConnectProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // State
    const [hasChannel, setHasChannel] = useState(initialHasChannel);
    const [savedChannelId, setSavedChannelId] = useState(initialChannelId);

    // Wizard State
    const [channels, setChannels] = useState<{ id: string, name: string }[]>([]);
    const [selectedChannel, setSelectedChannel] = useState(initialChannelId || "");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Detect OAuth Return
    const discordConnected = searchParams.get("discord_connected") === "true";
    const newGuildId = searchParams.get("guild_id");

    // Determine Step
    const [step, setStep] = useState<'initial' | 'picking_channel' | 'saving'>('initial');

    useEffect(() => {
        if (discordConnected && newGuildId) {
            setStep('picking_channel');
            fetchChannels(newGuildId);
        } else if (initialGuildId && !hasChannel) {
            // If we have a guild ID but no channel confirmed (re-editing)
            setStep('picking_channel');
            fetchChannels(initialGuildId);
        }
    }, [discordConnected, newGuildId, initialGuildId, hasChannel]);

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

        // Use new guild ID if available, otherwise fallback to prop
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
            // Clean up URL
            router.replace(pathname);
            router.refresh();
        }
    }

    // State for Channel Name Display
    const [channelName, setChannelName] = useState<string>("");

    useEffect(() => {
        // Condition: Connected and have Guild ID
        // Intent: Fetch the name of the connected channel for better UX
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

    // State: Fully Connected
    if (hasChannel) {
        return (
            <div className="p-4 bg-indigo-900/20 border border-indigo-800 rounded-xl text-sm text-indigo-300 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 flex-shrink-0 text-indigo-400" />
                    <div>
                        <p className="font-bold text-indigo-200">Discord Connected</p>
                        <p className="opacity-80 text-xs text-indigo-400">
                            Updates posting to channel <code className="bg-indigo-950 px-1 rounded">{channelName ? `#${channelName}` : savedChannelId}</code>
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        setHasChannel(false);
                        setStep('initial');
                    }}
                    className="text-xs opacity-60 hover:opacity-100 underline"
                >
                    Edit
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 bg-indigo-900/10 border border-indigo-800/50 rounded-xl space-y-4">
            <div className="flex items-start gap-3 text-indigo-300">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                    {/* Discord Icon SVG */}
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 127 96" xmlns="http://www.w3.org/2000/svg"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22c.63-23.28-18.68-47.5-35.3-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,54,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.23,53,91.1,65.69,84.69,65.69Z" /></svg>
                </div>
                <div className="space-y-1">
                    <p className="font-bold">Connect Discord Notifications</p>
                    <p className="opacity-90 text-xs text-slate-400">
                        {step === 'initial' && "Invite the bot to your server to start."}
                        {step === 'picking_channel' && "Select the channel for event updates."}
                    </p>
                </div>
            </div>

            {error && (
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
    );
}

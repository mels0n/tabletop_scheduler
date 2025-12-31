"use client";

import { useEventHistory } from "@/hooks/useEventHistory";
import Link from "next/link";
import { ArrowLeft, User as UserIcon, Calendar, Clock, RefreshCw, Send, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { sendGlobalMagicLink } from "@/app/actions";


import { DiscordLoginSender } from "@/components/DiscordLoginSender";

interface ServerEvent {
    slug: string;
    title: string;
    role: 'MANAGER' | 'PARTICIPANT';
    lastVisited: string; // ISO string
    eventId?: number;
    participantId?: number;
    source?: 'telegram' | 'discord';
}

/**
 * @component ProfileDashboard
 * @description Client-side dashboard for authenticated/identified users.
 *
 * Core Logic:
 * 1. Hybrid Data Source:
 *    - Merges `serverEvents` (fetched via persistent HTTP-only cookie).
 *    - Merges `localStorage` history (anonymous/device-based history).
 * 2. Identity Sync:
 *    - If server events contain `participantId`, it restores `localStorage` keys.
 *    - This allows a user to "log in" via Magic Link on a new device and immediately regain voting rights.
 * 3. Recovery:
 *    - Provides a "Magic Link" request form to elevate a session from Anonymous -> Authenticated.
 */
export function ProfileDashboard({ serverEvents = [], isTelegramSynced, isDiscordSynced }: { serverEvents?: ServerEvent[], isTelegramSynced?: boolean, isDiscordSynced?: boolean }) {
    const { history, validateHistory, bulkMerge } = useEventHistory();
    const [userName, setUserName] = useState("");

    // Recovery Form State
    const [handle, setHandle] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string, deepLink?: string } | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setUserName(localStorage.getItem('tabletop_username') || "Guest");
            validateHistory();
        }
    }, [validateHistory]);

    // Sync Server Events & Identities to Local Storage
    useEffect(() => {
        if (serverEvents.length > 0 && bulkMerge) {
            // 1. History Sync
            const toSync = serverEvents.map(e => ({
                slug: e.slug,
                title: e.title,
                lastVisited: new Date(e.lastVisited).getTime()
            }));
            bulkMerge(toSync);

            // 2. Identity Sync (Bulk restore voting status)
            // Intent: Re-hydrate local storage with participant IDs so the client "knows" who it is for each event
            serverEvents.forEach(e => {
                if (e.eventId && e.participantId) {
                    const key = `tabletop_participant_${e.eventId}`;
                    localStorage.setItem(key, e.participantId.toString());
                }
            });
        }
    }, [serverEvents, bulkMerge]);

    const handleRecovery = async () => {
        if (!handle) return;
        setLoading(true);
        setMsg(null);

        const res = await sendGlobalMagicLink(handle);

        if (res.success) {
            setMsg({ type: 'success', text: res.message || "Link sent!" });
        } else if (res.deepLink) {
            setMsg({ type: 'error', text: res.message || "Verification needed", deepLink: res.deepLink });
        } else {
            setMsg({ type: 'error', text: res.error || "Failed to find events" });
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12">
            <div className="max-w-3xl mx-auto space-y-8">
                <Link href="/" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors mb-4">
                    <ArrowLeft className="w-4 h-4" /> Back Home
                </Link>

                <div className="flex items-center gap-4 pb-8 border-b border-slate-800">
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400">
                        <UserIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-100">
                            Hello, {userName}
                        </h1>
                        <p className="text-slate-400 mb-2">Welcome to your event dashboard.</p>
                        <div className="flex flex-wrap gap-2">
                            {isTelegramSynced && (
                                <span className="text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 bg-green-900/40 text-green-400 rounded-full border border-green-800 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    Telegram Synced
                                </span>
                            )}
                            {isDiscordSynced && (
                                <span className="text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 bg-[#5865F2]/20 text-[#5865F2] rounded-full border border-[#5865F2]/50 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#5865F2] animate-pulse" />
                                    Discord Synced
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-slate-200 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-indigo-400" />
                            Your Events
                        </h2>
                    </div>

                    {history.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                            <p>You haven&apos;t visited any events yet.</p>
                            <Link href="/new" className="mt-4 inline-block px-4 py-2 bg-indigo-600 rounded-lg text-white text-sm font-medium hover:bg-indigo-500 transition-colors">
                                Create an Event
                            </Link>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {history.map(event => (
                                <Link
                                    key={event.slug}
                                    href={`/e/${event.slug}`}
                                    className="group block p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-indigo-500/30 transition-all"
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h3 className="font-semibold text-lg group-hover:text-indigo-300 transition-colors flex items-center gap-2">
                                                {event.title}
                                            </h3>
                                            <p className="text-xs text-slate-500 font-mono mt-1">
                                                {format(new Date(event.lastVisited), "MMM d, yyyy")}
                                            </p>
                                        </div>
                                        <ArrowRightIcon className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Magic Link Recovery Section */}
                <div className="pt-8 border-t border-slate-800">
                    <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-slate-400" />
                        Sync & Recover
                    </h3>

                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Telegram Panel */}
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
                            <h4 className="text-md font-semibold text-slate-200 mb-2 flex items-center gap-2">
                                <span className="text-sky-400">Telegram</span> Sync
                            </h4>
                            <p className="text-slate-400 text-sm mb-4">
                                Enter your Telegram Handle to receive a Magic Link.
                                <br />
                                <span className="text-xs text-slate-500 italic">(Requires you to have used your handle during voting previously)</span>
                            </p>

                            <div className="flex flex-col gap-3">
                                <input
                                    type="text"
                                    placeholder="@username"
                                    value={handle}
                                    onChange={(e) => setHandle(e.target.value)}
                                    className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500 outline-none"
                                />
                                <button
                                    onClick={handleRecovery}
                                    disabled={loading || !handle}
                                    className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    Send Link
                                </button>
                            </div>

                            {msg && (
                                <div className={`mt-4 p-3 rounded-lg text-sm border ${msg.type === 'success'
                                    ? 'bg-green-900/20 border-green-800 text-green-300'
                                    : 'bg-amber-900/20 border-amber-800 text-amber-300'
                                    }`}>
                                    <p className="font-medium mb-1">{msg.text}</p>
                                    {msg.deepLink && (
                                        <a
                                            href={msg.deepLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-2 inline-flex items-center gap-2 text-amber-300 hover:text-white underline"
                                        >
                                            <Lock className="w-3 h-3" />
                                            Open Telegram to Verify
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Discord Panel */}
                        <DiscordLoginSender />
                    </div>
                </div>

            </div >
        </div >
    )
}

function ArrowRightIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
        </svg>
    )
}

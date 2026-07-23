"use client";

import { useState, useEffect } from "react";
import { ClientDate, ClientTimezone } from "./ClientDate";
import { Check, HelpCircle, X, User as UserIcon, Loader2, LayoutList, CalendarDays, CalendarRange, Info } from "lucide-react";
import { clsx } from "clsx";
import { usePathname, useSearchParams } from "next/navigation";
import { SuggestTime } from "./SuggestTime";
import { QuickSelectionCalendar } from "./QuickSelectionCalendar";

interface Slot {
    id: number;
    startTime: Date;
    endTime: Date;
    counts: { yes: number; maybe: number; no: number };
    votes: any[];
}

interface VotingInterfaceProps {
    eventId: number;
    initialSlots: Slot[];
    participants: any[];
    minPlayers: number;
    slug: string;
    serverParticipantId?: number;
    discordIdentity?: { id: string, username: string };
    telegramIdentity?: { handle: string };
    eventType?: "ONE_SHOT" | "CAMPAIGN";
    isTelegramSynced?: boolean;
    isDiscordSynced?: boolean;
}

type ViewMode = "detailed" | "quick";

export function VotingInterface({ eventId, initialSlots, participants, minPlayers, slug, serverParticipantId, discordIdentity, telegramIdentity, eventType = "ONE_SHOT", isTelegramSynced, isDiscordSynced }: VotingInterfaceProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [slots, setSlots] = useState(initialSlots);
    const [userName, setUserName] = useState("");
    const [userTelegram, setUserTelegram] = useState("");
    const [votes, setVotes] = useState<Record<number, string | undefined>>({});
    const [canHost, setCanHost] = useState<Record<number, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasVoted, setHasVoted] = useState(false);
    const [participantId, setParticipantId] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("quick");
    const [campaignTooltipOpen, setCampaignTooltipOpen] = useState(false);
    // Per-platform identity linking. Each is only surfaced (and only meaningful)
    // when that platform is synced in this browser; both default to on.
    const [linkTelegram, setLinkTelegram] = useState(true);
    const [linkDiscord, setLinkDiscord] = useState(true);

    useEffect(() => {
        let pid = serverParticipantId;
        if (!pid) {
            const saved = localStorage.getItem(`tabletop_participant_${eventId}`);
            if (saved) pid = parseInt(saved);
        }

        if (pid) {
            setParticipantId(pid);

            if (serverParticipantId) {
                localStorage.setItem(`tabletop_participant_${eventId}`, pid.toString());
            }

            const existing = participants.find(p => p.id === pid);
            if (existing) {
                setUserName(existing.name);
                setUserTelegram(existing.telegramId || "");

                const myVotes: Record<number, string> = {};
                const myHosting: Record<number, boolean> = {};

                initialSlots.forEach(slot => {
                    const userVote = slot.votes.find((v: any) => v.participantId === pid);
                    if (userVote) {
                        myVotes[slot.id] = userVote.preference;
                        if (userVote.canHost) myHosting[slot.id] = true;
                    }
                });

                setVotes(myVotes);
                setCanHost(myHosting);
            }
        } else {
            const urlUserId = searchParams.get("userID");
            setUserName(prev => prev || urlUserId || localStorage.getItem('tabletop_username') || "");
            setUserTelegram(prev => prev || localStorage.getItem('tabletop_telegram') || "");
        }
    }, [serverParticipantId, eventId, participants, initialSlots, searchParams]);

    const handleVote = (slotId: number, preference: string) => {
        setVotes(prev => ({
            ...prev,
            [slotId]: prev[slotId] === preference ? undefined : preference
        }));
    };

    const toggleHost = (slotId: number) => {
        setCanHost(prev => ({ ...prev, [slotId]: !prev[slotId] }));
    };

    // Accepts an optional override so quick view can pass in NOs-filled map
    // without hitting React's async state update timing issue.
    const submitVotes = async (votesOverride?: Record<number, string | undefined>) => {
        const effectiveVotes = votesOverride ?? votes;

        if (!userName) return alert("Please enter your name");
        if (Object.values(effectiveVotes).filter(v => v !== undefined).length === 0)
            return alert("Please select at least one preference (or mark others as NO)");

        localStorage.setItem('tabletop_username', userName);
        localStorage.setItem('tabletop_telegram', userTelegram);

        setIsSubmitting(true);
        try {
            // A synced Telegram identity supplies its verified handle via the badge;
            // otherwise fall back to whatever the user typed in the manual field.
            const effectiveTelegram = telegramIdentity ? telegramIdentity.handle : userTelegram;

            const payload = {
                name: userName,
                telegramId: linkTelegram ? effectiveTelegram : "",
                discordId: linkDiscord ? discordIdentity?.id : undefined,
                discordUsername: linkDiscord ? discordIdentity?.username : undefined,
                participantId,
                linkTelegram,
                linkDiscord,
                votes: Object.entries(effectiveVotes)
                    .filter(([_, preference]) => preference !== undefined)
                    .map(([slotId, preference]) => ({
                        slotId: parseInt(slotId),
                        preference,
                        canHost: canHost[parseInt(slotId)] || false
                    }))
            };

            const res = await fetch(`/api/event/${eventId}/vote`, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.participantId) {
                    localStorage.setItem(`tabletop_participant_${eventId}`, data.participantId.toString());
                }
                setHasVoted(true);
                window.location.reload();
            } else {
                alert("Failed to save votes");
            }
        } catch (e) {
            console.error(e);
            alert("Error submitting votes");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Called by QuickSelectionCalendar — fills NOs then submits
    const handleQuickSave = (completeVotes: Record<number, string | undefined>) => {
        setVotes(completeVotes); // sync so detailed view reflects them if user switches back
        submitVotes(completeVotes);
    };

    if (hasVoted) {
        return (
            <div className="p-8 text-center border border-green-800 bg-green-900/20 rounded-xl">
                <h3 className="text-2xl font-bold text-green-400 mb-2">Votes Saved!</h3>
                <p className="text-slate-400">Thanks for helping us schedule this game.</p>
            </div>
        );
    }

    return (
        <div className="grid gap-8 lg:grid-cols-3">
            {/* Left Col: Voting Form */}
            <div className="lg:col-span-2 space-y-6">

                {/* Identity card */}
                <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                            <UserIcon className="w-5 h-5 text-indigo-400" />
                            Who are you?
                        </h3>

                        <div className="flex items-center gap-2">
                            {telegramIdentity && (
                                <div className="flex items-center gap-2 text-xs bg-[#229ED9]/20 text-[#229ED9] px-2 py-1 rounded border border-[#229ED9]/50">
                                    <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" /></svg>
                                    <span>@{telegramIdentity.handle}</span>
                                </div>
                            )}
                            {discordIdentity ? (
                                <div className="flex items-center gap-2 text-xs bg-[#5865F2]/20 text-[#5865F2] px-2 py-1 rounded border border-[#5865F2]/50">
                                    <svg className="w-3 h-3 fill-current" viewBox="0 0 127 96"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22c.63-23.28-18.68-47.5-35.3-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,54,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.23,53,91.1,65.69,84.69,65.69Z" /></svg>
                                    <span>{discordIdentity.username}</span>
                                </div>
                            ) : (
                                <a
                                    href={`/api/auth/discord?flow=login&returnTo=${encodeURIComponent(pathname || '/')}`}
                                    className="text-xs bg-[#5865F2] hover:bg-[#4752C4] text-white px-3 py-1.5 rounded transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-3 h-3 fill-current" viewBox="0 0 127 96"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22c.63-23.28-18.68-47.5-35.3-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,54,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.23,53,91.1,65.69,84.69,65.69Z" /></svg>
                                    Log in
                                </a>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                        <input
                            type="text"
                            placeholder="Your Name (Required)"
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-indigo-500 transition-colors text-base"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                        />
                        {/* Manual handle entry only when Telegram isn't already
                            surfaced as a verified badge above. */}
                        {!telegramIdentity && (
                            <input
                                type="text"
                                placeholder="Telegram Handle (Optional)"
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-indigo-500 transition-colors text-base"
                                value={userTelegram}
                                onChange={(e) => setUserTelegram(e.target.value)}
                            />
                        )}
                    </div>

                    {/* Per-platform link toggles — each shown only when that platform
                        is synced in this browser. */}
                    {(isTelegramSynced || isDiscordSynced) && (
                        <div className="flex flex-col gap-2 mt-4">
                            {isTelegramSynced && (
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={linkTelegram}
                                        onChange={(e) => setLinkTelegram(e.target.checked)}
                                        className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500/50"
                                    />
                                    <span className={clsx(
                                        "text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded-full border flex items-center gap-1",
                                        linkTelegram
                                            ? "bg-green-900/40 text-green-400 border-green-800"
                                            : "bg-slate-800/60 text-slate-500 border-slate-700"
                                    )}>
                                        {linkTelegram && <Check className="w-3 h-3" />}
                                        Link my Telegram{telegramIdentity ? ` @${telegramIdentity.handle}` : ""}
                                    </span>
                                </label>
                            )}
                            {isDiscordSynced && (
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={linkDiscord}
                                        onChange={(e) => setLinkDiscord(e.target.checked)}
                                        className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500/50"
                                    />
                                    <span className={clsx(
                                        "text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded-full border flex items-center gap-1",
                                        linkDiscord
                                            ? "bg-green-900/40 text-green-400 border-green-800"
                                            : "bg-slate-800/60 text-slate-500 border-slate-700"
                                    )}>
                                        {linkDiscord && <Check className="w-3 h-3" />}
                                        Link my Discord{discordIdentity ? ` ${discordIdentity.username}` : ""}
                                    </span>
                                </label>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Campaign context banner ── */}
                {eventType === "CAMPAIGN" && (
                    <div className="bg-indigo-950/50 border border-indigo-800/50 rounded-lg p-3 flex items-start gap-3">
                        <CalendarRange className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                        <div className="flex-1 text-sm text-indigo-200">
                            This is a multi-session campaign. Vote on every date you&apos;re available — the organizer will lock in multiple sessions.
                        </div>
                        <div className="relative shrink-0">
                            <button
                                type="button"
                                aria-label="More info about campaign voting"
                                onClick={() => setCampaignTooltipOpen(prev => !prev)}
                                onBlur={() => setCampaignTooltipOpen(false)}
                                className="text-indigo-400 hover:text-indigo-300 transition-colors focus:outline-none"
                            >
                                <Info className="w-4 h-4" />
                            </button>
                            {campaignTooltipOpen && (
                                <div className="absolute right-0 top-6 z-10 w-64 bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 shadow-lg">
                                    Your votes help the organizer find the best set of dates. Vote YES for any date you can make, even if you can only attend some sessions.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── View toggle ── */}
                <div className="flex rounded-lg border border-slate-700 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setViewMode("quick")}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2.5 flex-1 justify-center text-sm font-medium transition-colors",
                            viewMode === "quick"
                                ? "bg-slate-700 text-slate-200"
                                : "bg-slate-900/50 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                        )}
                    >
                        <CalendarDays className="w-4 h-4" />
                        Quick Calendar
                    </button>
                    <div className="w-px bg-slate-700" />
                    <button
                        type="button"
                        onClick={() => setViewMode("detailed")}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2.5 flex-1 justify-center text-sm font-medium transition-colors",
                            viewMode === "detailed"
                                ? "bg-slate-700 text-slate-200"
                                : "bg-slate-900/50 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                        )}
                    >
                        <LayoutList className="w-4 h-4" />
                        Detailed
                    </button>
                </div>

                {/* ── Detailed view ── */}
                {viewMode === "detailed" && (
                    <div className="space-y-4">
                        {/* Legend */}
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 text-xs text-slate-400 bg-slate-900/30 p-3 rounded-lg border border-slate-800/50">
                            <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-green-500" />
                                <span><b>Available:</b> Perfect for me</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <HelpCircle className="w-4 h-4 text-yellow-500" />
                                <span><b>If Needed:</b> Yes, not a preference</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-500 px-1">
                            <Loader2 className="w-3 h-3" />
                            <span>Prioritization applies at Finalization. Confirmed spots are locked.</span>
                        </div>

                        {slots.map(slot => {
                            const myVote = votes[slot.id];
                            const totalYes = slot.counts.yes;
                            const isViable = totalYes >= minPlayers;

                            return (
                                <div key={slot.id} className={clsx(
                                    "relative p-4 rounded-xl border transition-all",
                                    myVote === 'YES' ? "bg-green-950/30 border-green-600/50" :
                                        myVote === 'NO' ? "bg-red-950/10 border-red-900/30 opacity-60" :
                                            myVote === 'MAYBE' ? "bg-yellow-950/20 border-yellow-700/50" :
                                                "bg-slate-900/40 border-slate-800"
                                )}>
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div className="text-center sm:text-left">
                                            <div className="font-semibold text-lg text-slate-200">
                                                <ClientDate date={slot.startTime} formatStr="EEEE, MMMM do" />
                                            </div>
                                            <p className="text-sm text-indigo-200">
                                                <ClientDate date={slot.startTime} formatStr="h:mm a" /> - <ClientDate date={slot.endTime} formatStr="h:mm a" /> <ClientTimezone className="text-indigo-300/70 ml-1" />
                                            </p>
                                            <div className="mt-2 flex gap-2 text-xs">
                                                <span className="text-green-400">{slot.counts.yes} Yes</span>
                                                <span className="text-yellow-400">{slot.counts.maybe} If Needed</span>
                                                <span className="text-red-400">{slot.counts.no} No</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-lg border border-slate-800">
                                            <VoteButton
                                                active={myVote === 'YES'}
                                                onClick={() => handleVote(slot.id, 'YES')}
                                                color="green"
                                                icon={<Check className="w-5 h-5" />}
                                                label="Available"
                                                title="Yes, I can make it"
                                            />
                                            <VoteButton
                                                active={myVote === 'MAYBE'}
                                                onClick={() => handleVote(slot.id, 'MAYBE')}
                                                color="yellow"
                                                icon={<HelpCircle className="w-5 h-5" />}
                                                label="If Needed"
                                                title="I'll be there if you need me."
                                            />
                                            <VoteButton
                                                active={myVote === 'NO'}
                                                onClick={() => handleVote(slot.id, 'NO')}
                                                color="red"
                                                icon={<X className="w-5 h-5" />}
                                                label="No"
                                            />
                                        </div>
                                    </div>

                                    {(myVote === 'YES' || myVote === 'MAYBE') && (
                                        <div className="mt-3 pt-3 border-t border-slate-800/50 flex items-center justify-end gap-2">
                                            <label className="text-sm text-slate-400 cursor-pointer select-none flex items-center gap-2 hover:text-indigo-400 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500/50"
                                                    checked={canHost[slot.id] || false}
                                                    onChange={() => toggleHost(slot.id)}
                                                />
                                                I can host at my place
                                            </label>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        <button
                            onClick={() => submitVotes()}
                            disabled={isSubmitting || Object.values(votes).filter(v => v !== undefined).length < slots.length}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-800 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-900/20 transition-all flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" /> :
                                Object.values(votes).filter(v => v !== undefined).length < slots.length
                                    ? "Select preferences for all times"
                                    : "Submit Votes"}
                        </button>

                        <SuggestTime
                            slug={slug}
                            serverParticipantId={participantId || undefined}
                            participants={participants}
                        />
                    </div>
                )}

                {/* ── Quick Calendar view ── */}
                {viewMode === "quick" && (
                    <QuickSelectionCalendar
                        slots={slots}
                        votes={votes}
                        onVotesChange={setVotes}
                        onSave={handleQuickSave}
                        isSubmitting={isSubmitting}
                        userName={userName}
                        canHost={canHost}
                        onCanHostChange={setCanHost}
                    />
                )}
            </div>

            {/* Right Col: Participants List */}
            <div className="space-y-6">
                <div className="bg-slate-900/30 p-6 rounded-xl border border-slate-800 sticky top-6">
                    <h3 className="text-lg font-semibold text-slate-300 mb-4">Participants ({participants.length})</h3>
                    <ul className="space-y-3">
                        {participants.map(p => (
                            <li key={p.id} className="flex items-center gap-3 text-slate-400">
                                <div className="w-8 h-8 rounded-full bg-indigo-900/50 flex items-center justify-center text-indigo-300 font-bold text-xs">
                                    {p.name.substring(0, 2).toUpperCase()}
                                </div>
                                <span>{p.name}</span>
                            </li>
                        ))}
                        {participants.length === 0 && (
                            <li className="text-slate-600 italic text-sm">Be the first to vote!</li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
}

function VoteButton({ active, onClick, color, icon, label, title }: any) {
    const activeClasses: any = {
        green: "bg-green-600 text-white shadow-green-900/20",
        yellow: "bg-yellow-600 text-white shadow-yellow-900/20",
        red: "bg-red-600 text-white shadow-red-900/20"
    };

    return (
        <button
            onClick={onClick}
            aria-label={`Vote ${label}`}
            className={clsx(
                "p-3 rounded-md transition-all flex flex-col items-center gap-1 w-20",
                active ? `${activeClasses[color]} shadow-lg` : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
            )}
            title={title || label}
        >
            {icon}
            <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
        </button>
    );
}

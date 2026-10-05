"use client";

import { useState, useEffect } from "react";
import { ClientDate, ClientTimezone } from "./ClientDate";
import { Check, HelpCircle, X, User as UserIcon, Loader2, LayoutList, CalendarDays, CalendarRange, Info, Home } from "lucide-react";
import { clsx } from "clsx";
import { usePathname, useSearchParams } from "next/navigation";
import { SuggestTime } from "./SuggestTime";
import { QuickSelectionCalendar } from "./QuickSelectionCalendar";
import type { PublicParticipant, PublicSlot } from "@/features/event-management/model/dto";
import { PARTICIPANT_NOT_OWNED, voteErrorMessage } from "@/features/event-management/model/vote-errors";

type Slot = PublicSlot & {
    counts: { yes: number; maybe: number; no: number };
};

interface VotingInterfaceProps {
    eventId: number;
    initialSlots: Slot[];
    participants: PublicParticipant[];
    minPlayers: number;
    slug: string;
    serverParticipantId?: number;
    discordIdentity?: { username: string };
    telegramIdentity?: { handle: string };
    /** The viewer's own handle, resolved on the server from their verified identity. */
    myTelegramHandle?: string | null;
    eventType?: "ONE_SHOT" | "CAMPAIGN";
    isTelegramSynced?: boolean;
    isDiscordSynced?: boolean;
}

type ViewMode = "detailed" | "quick";

export function VotingInterface({ eventId, initialSlots, participants, slug, serverParticipantId, discordIdentity, telegramIdentity, myTelegramHandle, eventType = "ONE_SHOT", isTelegramSynced, isDiscordSynced }: VotingInterfaceProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [slots] = useState(initialSlots);
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
    // Set when the server refused to edit the stored participant (403 participant_not_owned):
    // holds the votes so they can be resubmitted as a brand new participant.
    const [notOwned, setNotOwned] = useState<{ message: string; votes: Record<number, string | undefined> } | null>(null);

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
                setUserTelegram((serverParticipantId ? myTelegramHandle : null) || localStorage.getItem('tabletop_telegram') || "");

                const myVotes: Record<number, string> = {};
                const myHosting: Record<number, boolean> = {};

                initialSlots.forEach(slot => {
                    const userVote = slot.votes.find(v => v.participantId === pid);
                    if (userVote) {
                        myVotes[slot.id] = userVote.value;
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
    }, [serverParticipantId, myTelegramHandle, eventId, participants, initialSlots, searchParams]);

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
    const submitVotes = async (
        votesOverride?: Record<number, string | undefined>,
        participantIdOverride?: number | null
    ) => {
        const effectiveVotes = votesOverride ?? votes;
        const effectiveParticipantId = participantIdOverride !== undefined ? participantIdOverride : participantId;

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
                discordUsername: linkDiscord ? discordIdentity?.username : undefined,
                participantId: effectiveParticipantId,
                // Proves this browser holds the event link; the API needs it to claim a legacy row.
                slug,
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
                // A 403 participant_not_owned gets its own message (sign in to edit) and an
                // offer to vote as a new participant instead.
                const body = await res.json().catch(() => null);
                const code = typeof body === "object" && body !== null ? (body as { code?: unknown }).code : undefined;
                if (res.status === 403 && code === PARTICIPANT_NOT_OWNED) {
                    setNotOwned({ message: voteErrorMessage(body), votes: effectiveVotes });
                } else {
                    alert(voteErrorMessage(body));
                }
            }
        } catch (e) {
            console.error("Failed to submit votes", e);
            alert("Error submitting votes");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Forget the participant this browser remembered for the event and submit the same votes fresh.
    const voteAsNewParticipant = () => {
        if (!notOwned) return;
        const pending = notOwned.votes;
        try {
            localStorage.removeItem(`tabletop_participant_${eventId}`);
        } catch {
            // Storage can be unavailable; the resubmit below still sends no participant id.
        }
        setParticipantId(null);
        setNotOwned(null);
        submitVotes(pending, null);
    };

    // Called by QuickSelectionCalendar: fills NOs then submits
    const handleQuickSave = (completeVotes: Record<number, string | undefined>) => {
        setVotes(completeVotes); // sync so detailed view reflects them if user switches back
        submitVotes(completeVotes);
    };

    if (hasVoted) {
        return (
            <div className="p-8 text-center border border-yes bg-yes-bg rounded-card">
                <h3 className="text-2xl font-bold text-yes mb-2">Votes Saved!</h3>
                <p className="text-parchment-2">Thanks for helping us schedule this game.</p>
            </div>
        );
    }

    return (
        <div className="grid gap-8 lg:grid-cols-3">
            {/* Left Col: Voting Form */}
            <div className="lg:col-span-2 space-y-6">

                {/* Identity card */}
                <div className="bg-surface p-6 rounded-card border border-line">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-parchment flex items-center gap-2">
                            <UserIcon className="w-5 h-5 text-gold-bright" aria-hidden="true" />
                            Who are you?
                        </h3>

                        <div className="flex items-center gap-2">
                            {telegramIdentity && (
                                <div className="flex items-center gap-2 text-xs bg-surface-2 text-telegram px-2 py-1 rounded-control border border-telegram/50">
                                    <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" /></svg>
                                    <span>@{telegramIdentity.handle}</span>
                                </div>
                            )}
                            {discordIdentity ? (
                                <div className="flex items-center gap-2 text-xs bg-surface-2 text-discord px-2 py-1 rounded-control border border-discord/50">
                                    <svg className="w-3 h-3 fill-current" viewBox="0 0 127 96"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22c.63-23.28-18.68-47.5-35.3-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,54,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.23,53,91.1,65.69,84.69,65.69Z" /></svg>
                                    <span>{discordIdentity.username}</span>
                                </div>
                            ) : (
                                <a
                                    href={`/api/auth/discord?flow=login&returnTo=${encodeURIComponent(pathname || '/')}`}
                                    className="text-xs bg-discord hover:bg-discord/90 text-white px-3 py-1.5 rounded-control transition-colors flex items-center gap-2"
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
                            className="field flex-1 px-4 py-3 text-base"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                        />
                        {/* Manual handle entry only when Telegram isn't already
                            surfaced as a verified badge above. */}
                        {!telegramIdentity && (
                            <input
                                type="text"
                                placeholder="Telegram Handle (Optional)"
                                className="field flex-1 px-4 py-3 text-base"
                                value={userTelegram}
                                onChange={(e) => setUserTelegram(e.target.value)}
                            />
                        )}
                    </div>

                    {/* Per-platform link toggles: each shown only when that platform
                        is synced in this browser. */}
                    {(isTelegramSynced || isDiscordSynced) && (
                        <div className="flex flex-col gap-2 mt-4">
                            {isTelegramSynced && (
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={linkTelegram}
                                        onChange={(e) => setLinkTelegram(e.target.checked)}
                                        className="rounded-control border-line-strong bg-field text-gold focus:ring-gold/50"
                                    />
                                    <span className={clsx(
                                        "text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded-control border flex items-center gap-1",
                                        linkTelegram
                                            ? "bg-yes-bg text-yes border-yes"
                                            : "bg-surface-2 text-mist border-line-strong"
                                    )}>
                                        {linkTelegram && <Check className="w-3 h-3" aria-hidden="true" />}
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
                                        className="rounded-control border-line-strong bg-field text-gold focus:ring-gold/50"
                                    />
                                    <span className={clsx(
                                        "text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded-control border flex items-center gap-1",
                                        linkDiscord
                                            ? "bg-yes-bg text-yes border-yes"
                                            : "bg-surface-2 text-mist border-line-strong"
                                    )}>
                                        {linkDiscord && <Check className="w-3 h-3" aria-hidden="true" />}
                                        Link my Discord{discordIdentity ? ` ${discordIdentity.username}` : ""}
                                    </span>
                                </label>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Campaign context banner ── */}
                {eventType === "CAMPAIGN" && (
                    <div className="bg-surface border border-line rounded-card p-3 flex items-start gap-3">
                        <CalendarRange className="w-5 h-5 text-gold-bright shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="flex-1 text-sm text-parchment-2">
                            This is a multi-session campaign. Vote on every date you&apos;re available, and the organizer will lock in multiple sessions.
                        </div>
                        <div className="relative shrink-0">
                            <button
                                type="button"
                                aria-label="More info about campaign voting"
                                onClick={() => setCampaignTooltipOpen(prev => !prev)}
                                onBlur={() => setCampaignTooltipOpen(false)}
                                className="text-gold-bright hover:text-parchment transition-colors"
                            >
                                <Info className="w-4 h-4" />
                            </button>
                            {campaignTooltipOpen && (
                                <div className="absolute right-0 top-6 z-10 w-64 bg-surface-2 border border-line-strong rounded-card p-3 text-xs text-parchment-2 shadow-modal">
                                    Your votes help the organizer find the best set of dates. Vote YES for any date you can make, even if you can only attend some sessions.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── View toggle ── */}
                <div className="segmented">
                    <button
                        type="button"
                        onClick={() => setViewMode("quick")}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2.5 justify-center text-sm font-medium transition-colors",
                            viewMode === "quick"
                                ? "is-active text-parchment"
                                : "text-mist hover:bg-surface-2 hover:text-parchment"
                        )}
                    >
                        <CalendarDays className="w-4 h-4" aria-hidden="true" />
                        Quick Calendar
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode("detailed")}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2.5 justify-center text-sm font-medium transition-colors",
                            viewMode === "detailed"
                                ? "is-active text-parchment"
                                : "text-mist hover:bg-surface-2 hover:text-parchment"
                        )}
                    >
                        <LayoutList className="w-4 h-4" aria-hidden="true" />
                        Detailed
                    </button>
                </div>

                {/* ── Detailed view ── */}
                {notOwned && (
                    <div role="alert" className="p-4 rounded-card border border-maybe bg-maybe-bg text-parchment space-y-3">
                        <p className="text-sm">{notOwned.message}</p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={voteAsNewParticipant}
                                disabled={isSubmitting}
                                className="px-4 py-2 rounded-control bg-maybe hover:bg-gold-bright disabled:opacity-50 text-on-maybe text-sm font-semibold transition-colors"
                            >
                                Vote as a new participant
                            </button>
                            <button
                                type="button"
                                onClick={() => setNotOwned(null)}
                                className="px-4 py-2 rounded-control border border-line-strong text-parchment hover:bg-surface-2 text-sm transition-colors"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                )}

                {viewMode === "detailed" && (
                    <div className="space-y-4">
                        {/* Legend */}
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 text-xs text-parchment-2 bg-surface p-3 rounded-card border border-line">
                            <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-yes" aria-hidden="true" />
                                <span><b>Available:</b> Perfect for me</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <HelpCircle className="w-4 h-4 text-maybe" aria-hidden="true" />
                                <span><b>If Needed:</b> Yes, not a preference</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-mist px-1">
                            <Loader2 className="w-3 h-3" aria-hidden="true" />
                            <span>Prioritization applies at Finalization. Confirmed spots are locked.</span>
                        </div>

                        {slots.map(slot => {
                            const myVote = votes[slot.id];
                            const hasHostOffer = slot.votes.some(
                                v => (v.value === "YES" || v.value === "MAYBE") && v.canHost
                            );

                            return (
                                <div key={slot.id} className={clsx(
                                    "relative p-4 rounded-card border transition-colors",
                                    myVote === 'YES' ? "bg-yes-bg border-yes" :
                                        myVote === 'NO' ? "bg-surface border-line opacity-60" :
                                            myVote === 'MAYBE' ? "bg-maybe-bg border-maybe" :
                                                "bg-surface border-line"
                                )}>
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div className="text-center sm:text-left">
                                            <div className="font-display font-semibold text-xl text-parchment">
                                                <ClientDate date={slot.startTime} formatStr="EEEE, MMMM do" />
                                            </div>
                                            <p className="text-sm text-mist tabular-nums">
                                                <ClientDate date={slot.startTime} formatStr="h:mm a" /> - <ClientDate date={slot.endTime} formatStr="h:mm a" /> <ClientTimezone className="text-mist ml-1" />
                                            </p>
                                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                                <span className="chip text-yes">{slot.counts.yes} Yes</span>
                                                <span className="chip text-maybe">{slot.counts.maybe} If Needed</span>
                                                <span className="chip text-no">{slot.counts.no} No</span>
                                                {hasHostOffer && (
                                                    <span className="chip text-gold-bright" title="Someone offered to host this time">
                                                        <Home className="w-3 h-3" aria-hidden="true" />
                                                        Host offered
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto p-1.5 bg-surface rounded-control border border-line">
                                            <VoteButton
                                                active={myVote === 'YES'}
                                                onClick={() => handleVote(slot.id, 'YES')}
                                                color="green"
                                                icon={<Check className="w-5 h-5" aria-hidden="true" />}
                                                label="Available"
                                                title="Yes, I can make it"
                                            />
                                            <VoteButton
                                                active={myVote === 'MAYBE'}
                                                onClick={() => handleVote(slot.id, 'MAYBE')}
                                                color="yellow"
                                                icon={<HelpCircle className="w-5 h-5" aria-hidden="true" />}
                                                label="If Needed"
                                                title="I'll be there if you need me."
                                            />
                                            <VoteButton
                                                active={myVote === 'NO'}
                                                onClick={() => handleVote(slot.id, 'NO')}
                                                color="red"
                                                icon={<X className="w-5 h-5" aria-hidden="true" />}
                                                label="No"
                                            />
                                        </div>
                                    </div>

                                    {(myVote === 'YES' || myVote === 'MAYBE') && (
                                        <div className="mt-3 pt-3 border-t border-line flex items-center justify-end gap-2">
                                            <label className="text-sm text-parchment-2 cursor-pointer select-none flex items-center gap-2 hover:text-gold-bright transition-colors">
                                                <input
                                                    type="checkbox"
                                                    className="rounded-control border-line-strong bg-field text-gold focus:ring-gold/50"
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
                            className="btn-primary w-full py-4 text-lg font-bold"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> :
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
            <div className="space-y-6 lg:sticky lg:top-20 self-start">
                <div className="bg-surface p-6 rounded-card border border-line">
                    <h3 className="text-lg font-semibold text-parchment mb-4">Participants ({participants.length})</h3>
                    <ul className="space-y-3">
                        {participants.map(p => (
                            <li key={p.id} className="flex items-center gap-3 text-parchment-2">
                                <div className="size-7 shrink-0 rounded-control bg-surface-2 flex items-center justify-center text-gold-bright font-bold text-xs">
                                    {p.name.substring(0, 2).toUpperCase()}
                                </div>
                                <span>{p.name}</span>
                            </li>
                        ))}
                        {participants.length === 0 && (
                            <li className="text-mist italic text-sm">Be the first to vote!</li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
}

function VoteButton({ active, onClick, color, icon, label, title }: any) {
    const activeClasses: any = {
        green: "bg-yes text-on-yes",
        yellow: "bg-maybe text-on-maybe",
        red: "bg-no text-on-no"
    };

    return (
        <button
            onClick={onClick}
            aria-label={`Vote ${label}`}
            className={clsx(
                "p-3 rounded-control border transition-colors flex flex-col items-center gap-1 sm:w-20",
                active ? `${activeClasses[color]} border-transparent` : "bg-field border-line-strong text-parchment-2 hover:bg-surface-2 hover:text-parchment"
            )}
            title={title || label}
        >
            {icon}
            <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
        </button>
    );
}

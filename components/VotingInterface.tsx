"use client";

import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { Check, HelpCircle, X, User as UserIcon, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { usePathname } from "next/navigation";

/**
 * @interface Slot
 * @description Represents a time slot with aggregated voting data.
 * @property {number} id - Unique slot ID.
 * @property {Date} startTime - Start time object.
 * @property {Date} endTime - End time object.
 * @property {Object} counts - Aggregated vote counts.
 * @property {any[]} votes - Array of detailed vote objects.
 */
interface Slot {
    id: number;
    startTime: Date;
    endTime: Date;
    counts: { yes: number; maybe: number; no: number };
    votes: any[];
}

/**
 * @interface VotingInterfaceProps
 * @description Props for the VotingInterface component.
 * @property {number} eventId - Unique event identifier.
 * @property {Slot[]} initialSlots - List of time slots with current vote data.
 * @property {any[]} participants - List of current participants.
 * @property {number} minPlayers - Minimum quorum required for a viable slot.
 * @property {number} [serverParticipantId] - Optional participant ID from server (e.g., via magic link).
 */
interface VotingInterfaceProps {
    eventId: number;
    initialSlots: Slot[];
    participants: any[];
    minPlayers: number;
    serverParticipantId?: number;
    discordIdentity?: { id: string, username: string };
}

/**
 * @component VotingInterface
 * @description The core interactive component for participants.
 * Responsibilities:
 * 1. Collects User Identity (Name, Telegram Handle).
 * 2. Displays available Time Slots with current global vote counts.
 * 3. Allows users to cast votes (YES/MAYBE/NO).
 * 4. "Can Host" toggle for logistic facilitation.
 * 5. Persists identity to LocalStorage for seamless "re-login" on the same device.
 *
 * @param {VotingInterfaceProps} props - Component props.
 * @returns {JSX.Element} The voting dashboard.
 */
export function VotingInterface({ eventId, initialSlots, participants, minPlayers, serverParticipantId, discordIdentity }: VotingInterfaceProps) {
    const pathname = usePathname();

    const [slots, setSlots] = useState(initialSlots);
    const [userName, setUserName] = useState("");
    const [userTelegram, setUserTelegram] = useState("");
    // Intent: Store local votes before submission. undefined means 'no vote selected yet'.
    const [votes, setVotes] = useState<Record<number, string | undefined>>({}); // slotId -> preference
    const [canHost, setCanHost] = useState<Record<number, boolean>>({}); // slotId -> canHost
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasVoted, setHasVoted] = useState(false);
    const [participantId, setParticipantId] = useState<number | null>(null);

    // Intent: Hydrate state (Server > LocalStorage) to restore user session.
    // Critical for UX so users don't have to re-enter their name every time they visit.
    useEffect(() => {
        // Priority 1: Server Identity (passed via Magic Link cookie)
        // Priority 2: Local Storage (returning user on same device)
        let pid = serverParticipantId;
        if (!pid) {
            const saved = localStorage.getItem(`tabletop_participant_${eventId}`);
            if (saved) pid = parseInt(saved);
        }

        if (pid) {
            setParticipantId(pid);

            // Intent: If we have a server ID, ensure local storage matches (Auto-Sync)
            // This 'logs them in' on this device for future visits without the magic link.
            if (serverParticipantId) {
                localStorage.setItem(`tabletop_participant_${eventId}`, pid.toString());
            }

            // Hydrate fields from existing participant data
            const existing = participants.find(p => p.id === pid);
            if (existing) {
                setUserName(existing.name);
                setUserTelegram(existing.telegramId || "");

                // Reconstruct voting state from server data
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
            // Intent: Fallback for new user - pre-fill from global user preferences if available.
            // Fix: Only overwrite if currently empty to prevent typing interruption if effect re-runs.
            setUserName(prev => prev || localStorage.getItem('tabletop_username') || "");
            setUserTelegram(prev => prev || localStorage.getItem('tabletop_telegram') || "");
        }
    }, [serverParticipantId, eventId, participants, initialSlots]);

    /**
     * Toggles vote preference for a specific slot.
     * Clicking the same preference again deselects it.
     */
    const handleVote = (slotId: number, preference: string) => {
        setVotes(prev => ({
            ...prev,
            [slotId]: prev[slotId] === preference ? undefined : preference
        }));
    };

    /**
     * Toggles the "Can Host" status. Only available if vote is YES or MAYBE.
     */
    const toggleHost = (slotId: number) => {
        setCanHost(prev => ({
            ...prev,
            [slotId]: !prev[slotId]
        }));
    }

    /**
     * Submits votes to the server.
     * Validates input, saves global profile to localStorage, and handles API interaction.
     */
    const submitVotes = async () => {
        if (!userName) return alert("Please enter your name");
        if (Object.keys(votes).length === 0) return alert("Please select at least one preference (or mark others as NO)");

        // Intent: Save profile globally for other events
        localStorage.setItem('tabletop_username', userName);
        localStorage.setItem('tabletop_telegram', userTelegram);

        setIsSubmitting(true);
        try {
            const payload = {
                name: userName,
                telegramId: userTelegram,
                participantId, // Send if we have it (update existing), otherwise create new
                votes: Object.entries(votes).map(([slotId, preference]) => ({
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
                    // Cache the new participant ID
                    localStorage.setItem(`tabletop_participant_${eventId}`, data.participantId.toString());
                }

                setHasVoted(true);
                // Intent: Force full page reload to reflect updated state and optimistic UI isn't fully implemented.
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

    if (hasVoted) {
        return (
            <div className="p-8 text-center border border-green-800 bg-green-900/20 rounded-xl">
                <h3 className="text-2xl font-bold text-green-400 mb-2">Votes Saved!</h3>
                <p className="text-slate-400">Thanks for helping us schedule this game.</p>
            </div>
        )
    }

    return (
        <div className="grid gap-8 lg:grid-cols-3">
            {/* Left Col: Voting Form */}
            <div className="lg:col-span-2 space-y-6">

                <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                            <UserIcon className="w-5 h-5 text-indigo-400" />
                            Who are you?
                        </h3>

                        {discordIdentity ? (
                            <div className="flex items-center gap-2 text-xs bg-[#5865F2]/20 text-[#5865F2] px-2 py-1 rounded border border-[#5865F2]/50">
                                {/* Simple Discord Logo */}
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

                    <div className="flex flex-col md:flex-row gap-4">
                        <input
                            type="text"
                            placeholder="Your Name (Required)"
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-indigo-500 transition-colors text-base"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="Telegram Handle (Optional)"
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:border-indigo-500 transition-colors text-base"
                            value={userTelegram}
                            onChange={(e) => setUserTelegram(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Legend for Mobile/Desktop clarity */}
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

                    {slots.map(slot => {
                        const start = new Date(slot.startTime);
                        const end = new Date(slot.endTime);
                        const myVote = votes[slot.id];

                        // Check if this slot meets quorum based on EXISTING votes + potentially my vote (optimistic not implemented here for brevity)
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
                                            {format(start, "EEEE, MMMM do")}
                                        </div>
                                        <div className="text-indigo-300 font-mono">
                                            {format(start, "h:mm a")} - {format(end, "h:mm a")}
                                        </div>
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

                                {/* Hosting Toggle */}
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
                        )
                    })}
                </div>

                <button
                    onClick={submitVotes}
                    disabled={isSubmitting}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-900/20 transition-all flex items-center justify-center gap-2"
                >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : "Submit Votes"}
                </button>
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
        </div >
    );
}

/**
 * @component VoteButton
 * @description Helper component for an individual vote option (YES/MAYBE/NO).
 *
 * @param {Object} props - implicit any, needs cleanup in future.
 * @returns {JSX.Element} The button.
 */
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
    )
}

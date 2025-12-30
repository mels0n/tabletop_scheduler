"use client";

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { Calendar, Clock, MapPin, Home, User as UserIcon, Loader2, Check } from "lucide-react";
import { clsx } from "clsx";
import { ClientDate } from "./ClientDate";
import { AddToCalendar } from "./AddToCalendar";

/**
 * @interface FinalizedEventViewProps
 * @description Props for the FinalizedEventView component.
 * @property {any} event - The full event object.
 * @property {any} finalizedSlot - The TimeSlot object that was selected as final.
 * @property {number} [serverParticipantId] - Optional ID if the user is already authenticated via server cookie.
 */
interface FinalizedEventViewProps {
    event: any;
    finalizedSlot: any;
    serverParticipantId?: number;
    discordIdentity?: { id: string, username: string };
}

/**
 * @component FinalizedEventView
 * @description Displays the "Ready to Play" dashboard for a finalized event.
 * Shows the final time, location, and host.
 * Allows users to "Join" the finalized session (RSVP YES) if they weren't originally part of the voting block.
 *
 * @param {FinalizedEventViewProps} props - Component props.
 * @returns {JSX.Element} The finalized event dashboard.
 */
export function FinalizedEventView({ event, finalizedSlot, serverParticipantId, discordIdentity }: FinalizedEventViewProps) {
    // Intent: State for handling the "Join" form inputs and submission status.
    const [userName, setUserName] = useState("");
    const [userTelegram, setUserTelegram] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasJoined, setHasJoined] = useState(false);
    const [participantId, setParticipantId] = useState<number | null>(null);

    // Intent: Filter participants who voted YES/MAYBE for this specific slot to display the "Going" list.
    // Memoize to prevent effect dependency churn.
    const attendees = useMemo(() => finalizedSlot.votes
        .filter((v: any) => v.preference === 'YES' || v.preference === 'MAYBE')
        .map((v: any) => ({
            ...v.participant,
            preference: v.preference
        })), [finalizedSlot.votes]);

    // Intent: Separate attendees (ACCEPTED) from waitlist (WAITLIST)
    const acceptedDetails = attendees.filter((a: any) => !a.status || a.status === 'ACCEPTED');
    const waitlistDetails = attendees.filter((a: any) => a.status === 'WAITLIST');

    const isFull = event.maxPlayers && acceptedDetails.length >= event.maxPlayers;

    // Intent: Check if user is already in attendees list (Priority: Server Cookie > LocalStorage)
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let pid = serverParticipantId;
        if (!pid) {
            const savedId = localStorage.getItem(`tabletop_participant_${event.id}`);
            if (savedId) pid = parseInt(savedId);
        }

        if (pid) {
            setParticipantId(pid);

            // Intent: Auto-Sync to local storage for future visits if server identified us.
            if (serverParticipantId) {
                localStorage.setItem(`tabletop_participant_${event.id}`, pid.toString());
            }

            // Intent: Check if this ID is in the current attendees list to update UI state.
            const isAttending = attendees.some((a: any) => a.id === pid);
            if (isAttending) {
                setHasJoined(true);
            }
        } else {
            // Intent: Pre-fill form from global preferences if not yet joined for this specific event.
            // Guard: Only set if state is empty to prevent overwriting user typing (Android/Edge issue)
            const savedName = localStorage.getItem('tabletop_username');
            const savedTele = localStorage.getItem('tabletop_telegram');
            if (savedName) setUserName(prev => prev || savedName);
            if (savedTele) setUserTelegram(prev => prev || savedTele);
        }
    }, [event.id, attendees, serverParticipantId]);

    /**
     * Handles the "Join" form submission.
     * Persists user identity and submits a 'YES' vote for the finalized slot.
     */
    const handleJoin = async () => {
        if (!userName) return alert("Please enter your name");

        setIsSubmitting(true);
        try {
            // Intent: Save global user preferences for convenience in future events.
            localStorage.setItem('tabletop_username', userName);
            localStorage.setItem('tabletop_telegram', userTelegram);

            // Intent: Construct vote payload: forcing 'YES' for the finalized slot.
            const payload = {
                name: userName,
                telegramId: userTelegram,
                participantId, // Send if updating existing participant or re-joining
                discordId: discordIdentity?.id,
                discordUsername: discordIdentity?.username,
                votes: [{
                    slotId: finalizedSlot.id,
                    preference: 'YES',
                    canHost: false // Guests don't host
                }]
            };

            const res = await fetch(`/api/event/${event.id}/vote`, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.participantId) {
                    localStorage.setItem(`tabletop_participant_${event.id}`, data.participantId.toString());
                }
                setHasJoined(true);
                window.location.reload(); // Intent: Refresh to ensure server-side lists update accurately.
            } else {
                alert("Failed to join event");
            }
        } catch (e) {
            console.error(e);
            alert("Error joining event");
        } finally {
            setIsSubmitting(false);
        }
    };

    const myStatus = attendees.find((a: any) => a.id === participantId)?.status;

    return (
        <div className="grid gap-8 lg:grid-cols-3">
            {/* LEFT COLUMN: Event Details & Join Form */}
            <div className="lg:col-span-2 space-y-8">

                {/* Finalized Summary Card */}
                <div className="bg-gradient-to-br from-green-900/20 to-slate-900 border border-green-800/50 rounded-2xl p-6 md:p-8 space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Calendar className="w-32 h-32" />
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">Passports Ready!</h2>
                        <p className="text-green-300">This event is finalized and ready to play.</p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="bg-slate-950/50 rounded-xl p-4 flex items-start gap-3 border border-slate-800">
                            <Clock className="w-5 h-5 text-indigo-400 mt-1" />
                            <div>
                                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">When</div>
                                <div className="font-semibold text-white">
                                    <ClientDate date={finalizedSlot.startTime} formatStr="EEEE, MMMM do" />
                                </div>
                                <div className="text-indigo-300 text-sm">
                                    <ClientDate date={finalizedSlot.startTime} formatStr="h:mm a" />
                                    {" - "}
                                    <ClientDate date={finalizedSlot.endTime} formatStr="h:mm a" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-950/50 rounded-xl p-4 flex items-start gap-3 border border-slate-800">
                            <MapPin className="w-5 h-5 text-red-400 mt-1" />
                            <div>
                                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Where</div>
                                <div className="font-semibold text-white">
                                    {event.location || "Location TBD"}
                                </div>
                                {event.finalizedHost && (
                                    <div className="flex items-center gap-1.5 text-slate-400 text-sm mt-1">
                                        <Home className="w-3 h-3" />
                                        <span>Hosted by {event.finalizedHost.name}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Add to Calendar */}
                    <div className="border-t border-slate-700/50 pt-6">
                        <AddToCalendar
                            event={event}
                            slot={finalizedSlot}
                        />
                    </div>
                </div>

                {/* Join Section */}
                {!hasJoined ? (
                    <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400">
                                    <UserIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">
                                        {isFull ? "Join the Waitlist" : "Join the Adventure"}
                                    </h3>
                                    <p className="text-slate-400 text-sm">
                                        {isFull
                                            ? `The event is full (${event.maxPlayers}/${event.maxPlayers}), but you can join the queue.`
                                            : "Add yourself to the guest list."}
                                    </p>
                                </div>
                            </div>

                            {/* Discord Login/Badge */}
                            {discordIdentity ? (
                                <div className="flex items-center gap-2 text-xs bg-[#5865F2]/20 text-[#5865F2] px-2 py-1 rounded border border-[#5865F2]/50">
                                    <svg className="w-3 h-3 fill-current" viewBox="0 0 127 96"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22c.63-23.28-18.68-47.5-35.3-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,54,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.23,53,91.1,65.69,84.69,65.69Z" /></svg>
                                    <span>{discordIdentity.username}</span>
                                </div>
                            ) : (
                                <a
                                    href={`/api/auth/discord?flow=login&returnTo=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')}`}
                                    className="text-xs bg-[#5865F2] hover:bg-[#4752C4] text-white px-3 py-1.5 rounded transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-3 h-3 fill-current" viewBox="0 0 127 96"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22c.63-23.28-18.68-47.5-35.3-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,54,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.23,53,91.1,65.69,84.69,65.69Z" /></svg>
                                    Log in
                                </a>
                            )}
                        </div>

                        <div className="space-y-4">
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

                            <button
                                onClick={handleJoin}
                                disabled={isSubmitting}
                                className={clsx(
                                    "w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2",
                                    isFull ? "bg-yellow-600 hover:bg-yellow-500 shadow-yellow-900/20 text-white" : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20 text-white"
                                )}
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" /> : (isFull ? "Join Waitlist" : "I'm Coming!")}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={clsx(
                        "p-6 rounded-xl flex items-center justify-between gap-4 border",
                        myStatus === 'WAITLIST' ? "bg-yellow-900/10 border-yellow-800/30" : "bg-green-900/10 border-green-800/30"
                    )}>
                        <div className="flex items-center gap-4">
                            <div className={clsx(
                                "w-12 h-12 rounded-full flex items-center justify-center",
                                myStatus === 'WAITLIST' ? "bg-yellow-900/30" : "bg-green-900/30"
                            )}>
                                {myStatus === 'WAITLIST' ? <Clock className="w-6 h-6 text-yellow-400" /> : <Check className="w-6 h-6 text-green-400" />}
                            </div>
                            <div>
                                <h3 className={clsx("text-lg font-bold", myStatus === 'WAITLIST' ? "text-yellow-300" : "text-green-300")}>
                                    {myStatus === 'WAITLIST' ? "You are on the Waitlist" : "You are on the list!"}
                                </h3>
                                <p className={clsx("text-sm", myStatus === 'WAITLIST' ? "text-yellow-400/60" : "text-green-400/60")}>
                                    {myStatus === 'WAITLIST' ? "We'll let you know if a spot opens up." : "See you at the session."}
                                </p>
                            </div>
                        </div>

                        {/* Give Up Spot Option */}
                        {myStatus === 'ACCEPTED' && waitlistDetails.length > 0 && (
                            <button
                                onClick={async () => {
                                    if (confirm("Are you sure you want to give up your spot? It will immediately go to the next person on the waitlist.")) {
                                        setIsSubmitting(true);
                                        try {
                                            const payload = {
                                                name: userName || localStorage.getItem('tabletop_username') || "Unknown",
                                                telegramId: userTelegram || localStorage.getItem('tabletop_telegram') || "",
                                                participantId,
                                                votes: [{
                                                    slotId: finalizedSlot.id,
                                                    preference: 'NO', // Relinquish spot
                                                    canHost: false
                                                }]
                                            };

                                            const res = await fetch(`/api/event/${event.id}/vote`, {
                                                method: 'POST',
                                                body: JSON.stringify(payload),
                                                headers: { 'Content-Type': 'application/json' }
                                            });

                                            if (res.ok) window.location.reload();
                                        } catch (e) {
                                            console.error(e);
                                            alert("Error updating status");
                                        } finally {
                                            setIsSubmitting(false);
                                        }
                                    }
                                }}
                                disabled={isSubmitting}
                                className="text-xs text-red-400 hover:text-red-300 underline disabled:opacity-50"
                            >
                                Give up spot
                            </button>
                        )}
                    </div>
                )}

            </div>

            {/* RIGHT COLUMN: Guest List */}
            <div className="space-y-6">
                <div className="bg-slate-900/30 p-6 rounded-xl border border-slate-800 sticky top-6">
                    <h3 className="text-lg font-semibold text-slate-300 mb-4 flex items-center justify-between">
                        <span>Going</span>
                        <div className="flex items-center gap-2">
                            <span className="bg-slate-800 text-slate-400 px-2 py-1 rounded text-xs">
                                {event.maxPlayers ? `${acceptedDetails.length}/${event.maxPlayers}` : acceptedDetails.length}
                            </span>
                        </div>
                    </h3>

                    <ul className="space-y-3">
                        {acceptedDetails.map((p: any) => (
                            <li key={p.id} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs ring-2 ring-slate-900">
                                    {p.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <div className={clsx("font-medium", p.id === participantId ? "text-indigo-300" : "text-slate-300")}>
                                        {p.name} {p.id === participantId && "(You)"}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>

                    {waitlistDetails.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-slate-800">
                            <h3 className="text-lg font-semibold text-slate-300 mb-4 flex items-center justify-between">
                                <span>Waitlist</span>
                                <span className="bg-yellow-900/30 text-yellow-500 px-2 py-1 rounded text-xs border border-yellow-900/50">{waitlistDetails.length}</span>
                            </h3>
                            <ul className="space-y-3">
                                {waitlistDetails.map((p: any) => (
                                    <li key={p.id} className="flex items-center gap-3 opacity-60">
                                        <div className="w-8 h-8 rounded-full bg-yellow-900/20 flex items-center justify-center text-yellow-600 font-bold text-xs ring-1 ring-yellow-900/50">
                                            {p.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-400">
                                                {p.name} {p.id === participantId && "(You)"}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

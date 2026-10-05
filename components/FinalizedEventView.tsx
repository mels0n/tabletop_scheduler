"use client";

import { useState, useEffect, useMemo } from "react";
import { Calendar, Clock, MapPin, Home, User as UserIcon, Loader2, Check } from "lucide-react";
import { clsx } from "clsx";
import { ClientDate, ClientTimezone } from "./ClientDate";
import { AddToCalendar } from "./AddToCalendar";
import type { PublicEvent, PublicParticipant, PublicSlot } from "@/features/event-management/model/dto";
import { voteErrorMessage } from "@/features/event-management/model/vote-errors";

/**
 * @interface FinalizedEventViewProps
 * @description Props for the FinalizedEventView component.
 * @property {PublicEvent} event - The public event DTO.
 * @property {PublicSlot} finalizedSlot - The time slot (with votes) that was selected as final.
 * @property {PublicParticipant[]} participants - Public participant DTOs, used to resolve voters.
 * @property {number} [serverParticipantId] - Optional ID if the user is already authenticated via server cookie.
 */
interface FinalizedEventViewProps {
    event: PublicEvent;
    finalizedSlot: PublicSlot;
    participants: PublicParticipant[];
    serverParticipantId?: number;
    discordIdentity?: { username: string };
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
export function FinalizedEventView({ event, finalizedSlot, participants, serverParticipantId, discordIdentity }: FinalizedEventViewProps) {
    // Intent: State for handling the "Join" form inputs and submission status.
    const [userName, setUserName] = useState("");
    const [userTelegram, setUserTelegram] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasJoined, setHasJoined] = useState(false);
    const [participantId, setParticipantId] = useState<number | null>(null);

    // Intent: Filter participants who voted YES/MAYBE for this specific slot to display the "Going" list.
    // Memoize to prevent effect dependency churn.
    const attendees = useMemo(() => {
        // 1. Filter candidates
        const participantsById = new Map(participants.map(p => [p.id, p]));
        const candidates = finalizedSlot.votes
            .filter(v => v.value === 'YES' || v.value === 'MAYBE')
            .flatMap(v => {
                const participant = participantsById.get(v.participantId);
                if (!participant) return [];
                return [{
                    ...participant,
                    preference: v.value,
                    voteCreatedAt: v.createdAt // Capture vote time for tie-breaking
                }];
            });

        // 2. Sort candidates: YES first, then by FIFO (Time)
        candidates.sort((a: any, b: any) => {
            // Primary: Preference (YES < MAYBE)
            if (a.preference !== b.preference) {
                return a.preference === 'YES' ? -1 : 1;
            }
            // Secondary: Time (Earliest first)
            return new Date(a.voteCreatedAt).getTime() - new Date(b.voteCreatedAt).getTime();
        });

        // 3. Assign Status (ACCEPTED vs WAITLIST) based on capacity
        // Note: usage of 'status' here is virtual for this view unless persisted backend status exists and overrides
        return candidates.map((c: any, index: number) => {
            // If backend already has a definitive status, respect it.
            // Otherwise, apply the "First Come First Serve" logic.
            const existingStatus = c.status && c.status !== 'PENDING' ? c.status : null;
            const computedStatus = (event.maxPlayers && index >= event.maxPlayers) ? 'WAITLIST' : 'ACCEPTED';
            return {
                ...c,
                status: existingStatus || computedStatus
            };
        });
    }, [finalizedSlot.votes, participants, event.maxPlayers]);

    // Intent: Separate attendees (ACCEPTED) from waitlist (WAITLIST)
    const acceptedDetails = attendees.filter((a: any) => a.status === 'ACCEPTED');
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
                // Proves this browser holds the event link; the API needs it to claim a legacy row.
                slug: event.slug,
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
                // A 403 participant_not_owned (or any other refusal) gets the specific message.
                alert(voteErrorMessage(await res.json().catch(() => null)));
            }
        } catch (e) {
            console.error("Failed to join event", e);
            alert("Error joining event");
        } finally {
            setIsSubmitting(false);
        }
    };

    const myStatus = attendees.find((a: any) => a.id === participantId)?.status;
    const spotsOpen = event.maxPlayers && acceptedDetails.length < event.maxPlayers;
    const isWaitlistedButSpaceAvailable = myStatus === 'WAITLIST' && spotsOpen;

    return (
        <div className="grid gap-8 lg:grid-cols-3">
            {/* LEFT COLUMN: Event Details & Join Form */}
            <div className="lg:col-span-2 space-y-8">

                {/* Finalized Summary Card */}
                <div className="bg-surface border border-line border-t-2 border-t-yes rounded-card p-6 md:p-8 space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Calendar className="w-32 h-32" aria-hidden="true" />
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold text-parchment mb-1">Passports Ready!</h2>
                        <p className="text-yes">This event is finalized and ready to play.</p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="bg-field rounded-control p-4 flex items-start gap-3 border border-line">
                            <Clock className="w-5 h-5 text-gold-bright mt-1" aria-hidden="true" />
                            <div>
                                <div className="eyebrow text-mist mb-1">When</div>
                                <div className="font-display text-xl font-semibold text-parchment">
                                    <ClientDate date={finalizedSlot.startTime} formatStr="EEEE, MMMM do" />
                                </div>
                                <p className="text-mist text-sm tabular-nums">
                                    <ClientDate date={finalizedSlot.startTime} formatStr="h:mm a" />
                                    {" - "}
                                    <ClientDate date={finalizedSlot.endTime} formatStr="h:mm a" />
                                    <ClientTimezone className="ml-1.5 text-mist font-normal text-base" />
                                </p>
                            </div>
                        </div>

                        <div className="bg-field rounded-control p-4 flex items-start gap-3 border border-line">
                            <MapPin className="w-5 h-5 text-gold-bright mt-1" aria-hidden="true" />
                            <div>
                                <div className="eyebrow text-mist mb-1">Where</div>
                                <div className="font-display text-xl font-semibold text-parchment">
                                    {event.location || "Location TBD"}
                                </div>
                                {event.finalizedHost && (
                                    <div className="flex items-center gap-1.5 text-parchment-2 text-sm mt-1">
                                        <Home className="w-3 h-3" aria-hidden="true" />
                                        <span>Hosted by {event.finalizedHost.name}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Add to Calendar */}
                    <div className="border-t border-line pt-6">
                        <AddToCalendar
                            event={{
                                title: event.title,
                                description: event.description || undefined,
                                location: event.location,
                                slug: event.slug,
                            }}
                            slot={finalizedSlot}
                        />
                    </div>
                </div>

                {/* Join Section */}
                {!hasJoined ? (
                    <div className="bg-surface border border-line rounded-card p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="icon-tile">
                                    <UserIcon className="w-5 h-5" aria-hidden="true" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-parchment">
                                        {isFull ? "Join the Waitlist" : "Join the Adventure"}
                                    </h3>
                                    <p className="text-mist text-sm">
                                        {isFull
                                            ? `The event is full (${event.maxPlayers}/${event.maxPlayers}), but you can join the queue.`
                                            : "Add yourself to the guest list."}
                                    </p>
                                </div>
                            </div>

                            {/* Discord Login/Badge */}
                            {discordIdentity ? (
                                <div className="flex items-center gap-2 text-xs bg-surface-2 text-discord-text px-2 py-1 rounded-control border border-discord/50">
                                    <svg className="w-3 h-3 fill-current" viewBox="0 0 127 96"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22c.63-23.28-18.68-47.5-35.3-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,54,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.23,53,91.1,65.69,84.69,65.69Z" /></svg>
                                    <span>{discordIdentity.username}</span>
                                </div>
                            ) : (
                                <a
                                    href={`/api/auth/discord?flow=login&returnTo=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')}`}
                                    className="text-xs bg-discord hover:bg-discord/90 text-white px-3 py-1.5 rounded-control transition-colors flex items-center gap-2"
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
                                    className="field flex-1 px-4 py-3 text-base"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                />
                                <input
                                    type="text"
                                    placeholder="Telegram Handle (Optional)"
                                    className="field flex-1 px-4 py-3 text-base"
                                    value={userTelegram}
                                    onChange={(e) => setUserTelegram(e.target.value)}
                                />
                            </div>

                            <button
                                onClick={handleJoin}
                                disabled={isSubmitting}
                                className={clsx(
                                    "btn w-full py-4 text-lg font-bold",
                                    isFull ? "bg-maybe hover:bg-gold-bright text-on-maybe" : "bg-gold hover:bg-gold-bright text-on-gold"
                                )}
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : (isFull ? "Join Waitlist" : "I'm Coming!")}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={clsx(
                        "p-6 rounded-card border transition-colors",
                        isWaitlistedButSpaceAvailable ? "bg-surface border-gold" :
                            myStatus === 'WAITLIST' ? "bg-maybe-bg border-maybe" : "bg-yes-bg border-yes"
                    )}>
                        <div className="flex items-center gap-4 mb-4">
                            <div className={clsx(
                                "w-12 h-12 rounded-card flex items-center justify-center shrink-0",
                                "bg-surface-2"
                            )}>
                                {isWaitlistedButSpaceAvailable ? <UserIcon className="w-6 h-6 text-gold-bright" aria-hidden="true" /> :
                                    myStatus === 'WAITLIST' ? <Clock className="w-6 h-6 text-maybe" aria-hidden="true" /> : <Check className="w-6 h-6 text-yes" aria-hidden="true" />}
                            </div>
                            <div>
                                <h3 className={clsx("text-lg font-bold",
                                    isWaitlistedButSpaceAvailable ? "text-gold-bright" :
                                        myStatus === 'WAITLIST' ? "text-maybe" : "text-yes"
                                )}>
                                    {isWaitlistedButSpaceAvailable ? "Spots are Open!" :
                                        myStatus === 'WAITLIST' ? "You are on the Waitlist" : "You are on the list!"}
                                </h3>
                                <p className={clsx("text-sm",
                                    "text-parchment-2"
                                )}>
                                    {isWaitlistedButSpaceAvailable ? "We have space! Change your RSVP to 'Available' to join." :
                                        myStatus === 'WAITLIST' ? "If a spot opens up you move in automatically, with a DM if you linked Telegram or Discord." : "See you at the session."}
                                </p>
                            </div>
                        </div>

                        {/* Action: Claim Spot */}
                        {isWaitlistedButSpaceAvailable && (
                            <button
                                onClick={handleJoin}
                                disabled={isSubmitting}
                                className="btn-primary w-full py-3 font-bold mb-2"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin w-5 h-5" aria-hidden="true" /> : "Claim Spot (RSVP Yes)"}
                            </button>
                        )}

                        {/* Give Up Spot Option */}
                        {myStatus === 'ACCEPTED' && waitlistDetails.length > 0 && (
                            <div className="flex justify-end">
                                <button
                                    onClick={async () => {
                                        if (confirm("Are you sure you want to give up your spot? It will immediately go to the next person on the waitlist.")) {
                                            setIsSubmitting(true);
                                            try {
                                                const payload = {
                                                    name: userName || localStorage.getItem('tabletop_username') || "Unknown",
                                                    telegramId: userTelegram || localStorage.getItem('tabletop_telegram') || "",
                                                    participantId,
                                                    slug: event.slug,
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

                                                if (res.ok) {
                                                    window.location.reload();
                                                } else {
                                                    alert(voteErrorMessage(await res.json().catch(() => null)));
                                                }
                                            } catch (e) {
                                                console.error("Failed to update attendance status", e);
                                                alert("Error updating status");
                                            } finally {
                                                setIsSubmitting(false);
                                            }
                                        }
                                    }}
                                    disabled={isSubmitting}
                                    className="text-xs text-no hover:text-parchment underline disabled:opacity-50"
                                >
                                    Give up spot
                                </button>
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* RIGHT COLUMN: Guest List */}
            <div className="space-y-6 lg:sticky lg:top-20 self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
                <div className="bg-surface p-6 rounded-card border border-line">
                    <h3 className="text-lg font-semibold text-parchment mb-4 flex items-center justify-between">
                        <span>Going</span>
                        <div className="flex items-center gap-2">
                            <span className="bg-surface-2 text-parchment-2 px-2 py-1 rounded-[3px] text-xs">
                                {event.maxPlayers ? `${acceptedDetails.length}/${event.maxPlayers}` : acceptedDetails.length}
                            </span>
                        </div>
                    </h3>

                    <ul className="space-y-3">
                        {acceptedDetails.map((p: any) => (
                            <li key={p.id} className="flex items-center gap-3">
                                <div className="size-7 shrink-0 rounded-control bg-surface-2 flex items-center justify-center text-gold-bright font-bold text-xs">
                                    {p.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <div className={clsx("font-medium", p.id === participantId ? "text-gold-bright" : "text-parchment-2")}>
                                        {p.name} {p.id === participantId && "(You)"}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>

                    {waitlistDetails.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-line">
                            <h3 className="text-lg font-semibold text-parchment mb-4 flex items-center justify-between">
                                <span>Waitlist</span>
                                <span className="bg-maybe-bg text-maybe px-2 py-1 rounded-[3px] text-xs border border-maybe">{waitlistDetails.length}</span>
                            </h3>
                            <ul className="space-y-3">
                                {waitlistDetails.map((p: any) => (
                                    <li key={p.id} className="flex items-center gap-3">
                                        <div className="size-7 shrink-0 rounded-control bg-maybe-bg flex items-center justify-center text-maybe font-bold text-xs border border-dashed border-maybe">
                                            {p.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-medium text-mist">
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

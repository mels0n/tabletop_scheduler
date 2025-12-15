"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * @interface ManagerVoteWarningProps
 * @description Props for the ManagerVoteWarning component.
 * @property {number} eventId - Th e event ID.
 * @property {Array<{id: number}>} participants - List of existing participants.
 * @property {string} slug - The event slug.
 */
interface ManagerVoteWarningProps {
    eventId: number;
    participants: { id: number }[];
    slug: string;
}

/**
 * @component ManagerVoteWarning
 * @description A gentle nudge for the Event Coordinator to cast their own votes.
 * Checks localStorage to see if the current user (the manager) has a Participant ID
 * associated with this event. If not, displays a warning banner.
 *
 * @param {ManagerVoteWarningProps} props - Component props.
 * @returns {JSX.Element | null} The warning banner or null if they have voted.
 */
export function ManagerVoteWarning({ eventId, participants, slug }: ManagerVoteWarningProps) {
    const [shouldWarn, setShouldWarn] = useState(false);

    // Intent: Verify voting status on mount using client-side storage.
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // 1. Check if we have a participant ID in local storage for this event
        const savedParticipantId = localStorage.getItem(`tabletop_participant_${eventId}`);

        if (savedParticipantId) {
            const pid = parseInt(savedParticipantId);
            // 2. Intent: Validate that the stored ID matches a real participant in the current list.
            // This handles cases where the participant was deleted server-side but the cookie remains.
            const hasVoted = participants.some(p => p.id === pid);

            if (hasVoted) {
                setShouldWarn(false);
                return;
            }
        }

        // Logic: If no ID or ID not found in list -> They haven't voted.
        // We assume the manager IS the user viewing this page (since this component is likely only rendered on manager views).
        setShouldWarn(true);
    }, [eventId, participants]);

    if (!shouldWarn) return null;

    return (
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                <div className="text-sm">
                    <p className="text-yellow-200 font-medium">You haven&apos;t voted yet!</p>
                    <p className="text-yellow-200/70">Remember to cast your own votes for this event.</p>
                </div>
            </div>
            <Link
                href={`/e/${slug}`}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-bold rounded-lg transition-colors whitespace-nowrap"
            >
                Vote Now
            </Link>
        </div>
    );
}

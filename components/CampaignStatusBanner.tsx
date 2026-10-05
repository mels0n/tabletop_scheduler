'use client';

import { useEffect, useState } from 'react';
import { Ticket, TriangleAlert, CircleSlash } from 'lucide-react';

interface Props {
    eventId: number;
    acceptedIds: number[];
    waitlistIds: number[];
    serverParticipantId?: number;
}

export function CampaignStatusBanner({ eventId, acceptedIds, waitlistIds, serverParticipantId }: Props) {
    const [status, setStatus] = useState<'ACCEPTED' | 'WAITLIST' | 'NOT_SELECTED' | null>(null);

    useEffect(() => {
        // Mirror FinalizedEventView: server cookie identity first, then localStorage fallback
        let pid = serverParticipantId;
        if (!pid) {
            const saved = localStorage.getItem(`tabletop_participant_${eventId}`);
            if (saved) pid = parseInt(saved);
        }
        if (!pid || isNaN(pid)) return;

        if (acceptedIds.includes(pid)) setStatus('ACCEPTED');
        else if (waitlistIds.includes(pid)) setStatus('WAITLIST');
        else setStatus('NOT_SELECTED');
    }, [eventId, acceptedIds, waitlistIds, serverParticipantId]);

    if (!status) return null;

    if (status === 'ACCEPTED') return (
        <div className="flex items-center gap-3 p-4 rounded-card bg-yes-bg border border-yes">
            <Ticket className="w-6 h-6 shrink-0 text-yes" aria-hidden="true" />
            <div>
                <p className="font-bold text-yes text-lg">You&apos;re in the campaign!</p>
                <p className="text-parchment-2 text-sm">You&apos;re confirmed for all sessions below. Add them to your calendar.</p>
            </div>
        </div>
    );

    if (status === 'WAITLIST') return (
        <div className="flex items-center gap-3 p-4 rounded-card bg-maybe-bg border border-maybe">
            <TriangleAlert className="w-6 h-6 shrink-0 text-maybe" aria-hidden="true" />
            <div>
                <p className="font-bold text-maybe text-lg">You&apos;re on the waitlist</p>
                <p className="text-parchment-2 text-sm">If a spot opens up you move in automatically, with a DM if you linked Telegram or Discord.</p>
            </div>
        </div>
    );

    return (
        <div className="flex items-center gap-3 p-4 rounded-card bg-surface border border-line">
            <CircleSlash className="w-6 h-6 shrink-0 text-mist" aria-hidden="true" />
            <div>
                <p className="font-bold text-parchment text-lg">You weren&apos;t selected for this campaign</p>
                <p className="text-mist text-sm">The organiser has confirmed their group. Better luck next time!</p>
            </div>
        </div>
    );
}

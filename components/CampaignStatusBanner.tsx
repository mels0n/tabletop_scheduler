'use client';

import { useEffect, useState } from 'react';

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
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-900/20 border border-green-800/50">
            <span className="text-2xl">🎟️</span>
            <div>
                <p className="font-bold text-green-300 text-lg">You&apos;re in the campaign!</p>
                <p className="text-green-400/70 text-sm">You&apos;re confirmed for all sessions below. Add them to your calendar.</p>
            </div>
        </div>
    );

    if (status === 'WAITLIST') return (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-yellow-900/20 border border-yellow-800/50">
            <span className="text-2xl">⚠️</span>
            <div>
                <p className="font-bold text-yellow-300 text-lg">You&apos;re on the waitlist</p>
                <p className="text-yellow-400/70 text-sm">You&apos;ll be contacted if a spot opens up for a session.</p>
            </div>
        </div>
    );

    return (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <span className="text-2xl">😔</span>
            <div>
                <p className="font-bold text-slate-300 text-lg">You weren&apos;t selected for this campaign</p>
                <p className="text-slate-400 text-sm">The organiser has confirmed their group. Better luck next time!</p>
            </div>
        </div>
    );
}

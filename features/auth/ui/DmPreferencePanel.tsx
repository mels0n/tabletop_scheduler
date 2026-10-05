"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { setDmPreference } from "@/features/auth/server/dm-preference";

type Platform = 'telegram' | 'discord';

const PLATFORM_LABEL: Record<Platform, string> = {
    telegram: 'Telegram',
    discord: 'Discord',
};

/** Per platform: true when bot direct messages are off, false when on, null when not linked. */
export interface DmPreferenceState {
    telegram: boolean | null;
    discord: boolean | null;
}

/**
 * @component DmToggleRow
 * @description One linked platform's "Direct messages from the bot" switch. The switch
 * shows the saved state; it flips only after the server action confirms the change.
 */
function DmToggleRow({ platform, initialOptOut }: { platform: Platform; initialOptOut: boolean }) {
    const router = useRouter();
    const [optOut, setOptOut] = useState(initialOptOut);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const label = PLATFORM_LABEL[platform];
    const enabled = !optOut;

    const handleToggle = async () => {
        if (pending) return;
        setPending(true);
        setError(null);
        const res = await setDmPreference(platform, !optOut);
        setPending(false);
        if ('error' in res) {
            setError(res.error);
        } else {
            setOptOut(res.optOut);
            router.refresh();
        }
    };

    return (
        <div className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm font-medium text-parchment">{label}</p>
                    <p className="text-xs text-mist">Direct messages from the bot</p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`${label} direct messages from the bot`}
                    onClick={handleToggle}
                    disabled={pending}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-control border disabled:opacity-50 transition-colors ${
                        enabled
                            ? 'text-yes border-yes hover:bg-yes-bg'
                            : 'text-mist border-line-strong hover:bg-surface-2'
                    }`}
                >
                    <span data-dot className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-yes' : 'border border-mist'}`} />
                    {enabled ? 'On' : 'Off'}
                </button>
            </div>
            {error && <p className="text-xs mt-2 text-maybe">{error}</p>}
        </div>
    );
}

/**
 * @component DmPreferencePanel
 * @description Lets a linked user turn off bot direct messages per platform. Renders
 * nothing when no platform is linked on this browser.
 */
export function DmPreferencePanel({ preferences }: { preferences: DmPreferenceState }) {
    const linked = (['telegram', 'discord'] as const).filter(p => preferences[p] !== null);
    if (linked.length === 0) return null;

    return (
        <div className="pt-8 border-t border-line">
            <h3 className="text-lg font-medium text-parchment mb-1 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gold-bright" />
                Direct Messages
            </h3>
            <p className="text-xs text-mist mb-4">
                Turns off results, waitlist and removal notices, and organizer alerts sent to you by
                direct message. Group and channel posts are not affected. Login links you request
                are always sent.
            </p>
            <div className="bg-surface border border-line rounded-card px-6 py-3 divide-y divide-line">
                {linked.map(platform => (
                    <DmToggleRow key={platform} platform={platform} initialOptOut={preferences[platform] === true} />
                ))}
            </div>
        </div>
    );
}

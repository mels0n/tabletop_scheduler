'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

interface Participant {
    id: number;
    name: string;
}

interface FinalizeEventModalProps {
    slug: string;
    slotId: number;
    potentialHosts: Participant[];
    prominent?: boolean;
}

// Intent: the dialog body is only needed once the manager opens it, so it lives in
// its own chunk, loaded on demand and prefetched when the trigger is hovered or focused.
const loadDialog = () => import('./FinalizeEventDialog').then(m => m.FinalizeEventDialog);
const FinalizeEventDialog = dynamic(loadDialog, { ssr: false });
const preload = () => { void loadDialog(); };

/**
 * @component FinalizeEventModal
 * @description Trigger for the "Commit" dialog where the manager selects the Host and Location
 * for a specific Time Slot. The dialog itself (form state, submission) is `FinalizeEventDialog`.
 */
export function FinalizeEventModal({ slug, slotId, potentialHosts, prominent = false }: FinalizeEventModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    // Intent: once opened, the dialog stays mounted (rendering nothing while closed) so its
    // form state survives close and reopen exactly as it did before the dialog was split out.
    const [hasOpened, setHasOpened] = useState(false);

    const open = () => {
        setHasOpened(true);
        setIsOpen(true);
    };

    return (
        <>
            {!isOpen && (
                <button
                    onClick={open}
                    onPointerEnter={preload}
                    onFocus={preload}
                    className={prominent
                        ? "shrink-0 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-900/40 hover:shadow-indigo-900/60"
                        : "shrink-0 px-4 py-1.5 rounded-lg border border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 text-xs font-medium transition-all"
                    }
                >
                    Finalize
                </button>
            )}
            {hasOpened && (
                <FinalizeEventDialog
                    open={isOpen}
                    onClose={() => setIsOpen(false)}
                    slug={slug}
                    slotId={slotId}
                    potentialHosts={potentialHosts}
                />
            )}
        </>
    );
}

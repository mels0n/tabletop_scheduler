'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Calendar } from 'lucide-react';
import type { Slot } from './CampaignFinalizeDialog';

interface CampaignFinalizeModalProps {
    slug: string;
    minSessions: number;
    slots: Slot[];
}

// Intent: load the dialog body on demand; prefetch it when the trigger is hovered or focused.
const loadDialog = () => import('./CampaignFinalizeDialog').then(m => m.CampaignFinalizeDialog);
const CampaignFinalizeDialog = dynamic(loadDialog, { ssr: false });
const preload = () => { void loadDialog(); };

export function CampaignFinalizeModal({ slug, minSessions, slots }: CampaignFinalizeModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    // Intent: once opened, the dialog stays mounted (rendering nothing while closed) so its
    // selections survive close and reopen exactly as they did before the dialog was split out.
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
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-900/30 transition-all"
                >
                    <Calendar className="w-4 h-4" />
                    Finalize Campaign Sessions
                </button>
            )}
            {hasOpened && (
                <CampaignFinalizeDialog
                    open={isOpen}
                    onClose={() => setIsOpen(false)}
                    slug={slug}
                    minSessions={minSessions}
                    slots={slots}
                />
            )}
        </>
    );
}

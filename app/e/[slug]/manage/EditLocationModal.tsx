'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Pencil } from 'lucide-react';

interface EditLocationModalProps {
    slug: string;
    initialLocation: string | null;
}

// Intent: load the dialog body on demand; prefetch it when the trigger is hovered or focused.
const loadDialog = () => import('./EditLocationDialog').then(m => m.EditLocationDialog);
const EditLocationDialog = dynamic(loadDialog, { ssr: false });
const preload = () => { void loadDialog(); };

/**
 * @component EditLocationModal
 * @description Trigger (pencil icon) for the lightweight dialog that updates the event
 * location POST-finalization. The dialog itself is `EditLocationDialog`.
 */
export function EditLocationModal({ slug, initialLocation }: EditLocationModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    // Intent: once opened, the dialog stays mounted (rendering nothing while closed) so its
    // state survives close and reopen exactly as it did before the dialog was split out.
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
                    className="ml-2 p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                    title="Edit Location"
                >
                    <Pencil className="w-3 h-3" />
                </button>
            )}
            {hasOpened && (
                <EditLocationDialog
                    open={isOpen}
                    onClose={() => setIsOpen(false)}
                    slug={slug}
                    initialLocation={initialLocation}
                />
            )}
        </>
    );
}

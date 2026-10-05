'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Loader2 } from 'lucide-react';

interface EditLocationDialogProps {
    open: boolean;
    onClose: () => void;
    slug: string;
    initialLocation: string | null;
}

/**
 * @component EditLocationDialog
 * @description A lightweight modal for updating the event location POST-finalization.
 *
 * User Flow:
 * 1. Manager clicks the "Edit" pencil icon.
 * 2. Inputs new location (e.g., "Main St. Café").
 * 3. On Submit: API update triggers Telegram sync to edit the pinned message.
 * 4. UI refreshes to show the new location immediately.
 *
 * Performance:
 * Uses optimsitic-like UI states (`isSubmitting`) but relies on `router.refresh()`
 * to re-fetch the server component data rather than local state duplication.
 */
export function EditLocationDialog({ open, onClose, slug, initialLocation }: EditLocationDialogProps) {
    const [location, setLocation] = useState(initialLocation || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);

    // Intent: the dialog stays mounted while closed, so autoFocus (mount-only) is replaced by focusing on each open.
    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const res = await fetch(`/api/event/${slug}/location`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ location })
            });

            if (!res.ok) throw new Error('Failed to update location');

            onClose();
            // Intent: Re-run Server Components to display updated location from DB.
            router.refresh();
        } catch (error) {
            console.error("Failed to update location", error);
            alert('Failed to update location');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-indigo-400" />
                        Edit Location
                    </h3>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="space-y-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="e.g. 123 Main St"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
                        />
                        <p className="text-xs text-slate-500">
                            Updates calendars and Telegram notification.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => onClose()}
                            className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-xs shadow-lg shadow-indigo-900/20 transition-all flex items-center gap-2"
                        >
                            {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

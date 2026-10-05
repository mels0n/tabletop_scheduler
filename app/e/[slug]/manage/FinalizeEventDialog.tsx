'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, MapPin, User, Check, Loader2 } from 'lucide-react';

interface Participant {
    id: number;
    name: string;
}

interface FinalizeEventDialogProps {
    open: boolean;
    onClose: () => void;
    slug: string;
    slotId: number;
    potentialHosts: Participant[];
}

/**
 * @component FinalizeEventDialog
 * @description The crucial "Commit" UI where the manager selects the Host and Location for a specific Time Slot.
 *
 * User Flow:
 * 1. Manager clicks "Finalize" on a specific Time Slot card.
 * 2. Modal opens, pre-filtering "Potential Hosts" (users who voted "Yes" AND "Can Host").
 * 3. Manager selects a Host (or "TBD") and enters a Location.
 * 4. Submission triggers the `/api/event/[slug]/finalize` endpoint.
 *
 * UX/UI Logic:
 * - Auto-selects the host if only one person volunteered to host.
 * - Displays a warning if NO ONE volunteered to host.
 * - Handles form submission with loading states and global router refresh.
 */
export function FinalizeEventDialog({ open, onClose, slug, slotId, potentialHosts }: FinalizeEventDialogProps) {
    // Intent: Auto-select if there's only one potential host to save clicks.
    const [selectedHostId, setSelectedHostId] = useState<string>(
        potentialHosts.length === 1 ? potentialHosts[0].id.toString() : ''
    );
    const [address, setAddress] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const formData = new FormData();
        formData.append('slotId', slotId.toString());
        if (selectedHostId) formData.append('houseId', selectedHostId);
        if (address) formData.append('location', address);

        try {
            const res = await fetch(`/api/event/${slug}/finalize`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error('Failed to finalize');

            onClose();
            router.refresh();
        } catch (error) {
            console.error("Failed to finalize event", error);
            alert('Something went wrong. Please try again.');
            setIsSubmitting(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/85 animate-in fade-in duration-200">
            <div className="bg-surface border border-line rounded-card w-full max-w-md shadow-modal overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-line flex justify-between items-center bg-surface">
                    <h3 className="font-semibold text-parchment">Finalize Event</h3>
                    <button
                        onClick={() => onClose()}
                        className="text-mist hover:text-parchment p-1 rounded-control hover:bg-surface-2 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-parchment-2 flex items-center gap-2">
                                <User className="w-4 h-4 text-gold-bright" />
                                Who is hosting?
                            </label>

                            {potentialHosts.length > 0 ? (
                                <div className="grid gap-2">
                                    {potentialHosts.map(host => (
                                        <label
                                            key={host.id}
                                            className={`flex items-center gap-3 p-3 rounded-control border cursor-pointer transition-all ${selectedHostId === host.id.toString()
                                                ? 'bg-surface-2 border-gold text-parchment'
                                                : 'bg-field border-line-strong text-mist hover:border-gold'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="host"
                                                value={host.id}
                                                checked={selectedHostId === host.id.toString()}
                                                onChange={(e) => setSelectedHostId(e.target.value)}
                                                className="hidden"
                                            />
                                            {selectedHostId === host.id.toString() && <Check className="w-4 h-4 text-gold-bright" />}
                                            <span className="font-medium">{host.name}</span>
                                        </label>
                                    ))}
                                    {potentialHosts.length === 0 && (
                                        <label
                                            className={`flex items-center gap-3 p-3 rounded-control border cursor-pointer transition-all ${selectedHostId === ''
                                                ? 'bg-surface-2 border-gold text-parchment'
                                                : 'bg-field border-line-strong text-mist hover:border-gold'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="host"
                                                value=""
                                                checked={selectedHostId === ''}
                                                onChange={() => setSelectedHostId('')}
                                                className="hidden"
                                            />
                                            {selectedHostId === '' && <Check className="w-4 h-4 text-gold-bright" />}
                                            <span className="font-medium">No one / TBD</span>
                                        </label>
                                    )}
                                </div>
                            ) : (
                                <div className="p-3 bg-maybe-bg border border-maybe rounded-control text-maybe text-sm">
                                    No participants marked &quot;I can host&quot; for this slot.
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-parchment-2 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gold-bright" />
                                Location / Address
                            </label>
                            <input
                                type="text"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="e.g. 123 Main St, Apt 4B"
                                className="field w-full"
                            />
                            <p className="text-xs text-mist">
                                This will be sent to attendees and added to calendar invites.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => onClose()}
                            className="px-4 py-2 text-sm font-medium text-mist hover:text-parchment transition-colors"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-gold hover:bg-gold-bright text-on-gold rounded-control font-medium text-sm transition-all flex items-center gap-2"
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            Confirm & Finalize
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

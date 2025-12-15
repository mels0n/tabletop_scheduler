'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, MapPin, User, Check, Loader2 } from 'lucide-react';

interface Participant {
    id: number;
    name: string;
}

interface FinalizeEventModalProps {
    slug: string;
    slotId: number;
    potentialHosts: Participant[];
}

/**
 * @component FinalizeEventModal
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
export function FinalizeEventModal({ slug, slotId, potentialHosts }: FinalizeEventModalProps) {
    const [isOpen, setIsOpen] = useState(false);
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

            setIsOpen(false);
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('Something went wrong. Please try again.');
            setIsSubmitting(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600/10 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 hover:border-indigo-500 font-medium text-sm transition-all"
            >
                Finalize
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <h3 className="font-semibold text-slate-100">Finalize Event</h3>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-slate-400 hover:text-slate-200 p-1 rounded-full hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                <User className="w-4 h-4 text-indigo-400" />
                                Who is hosting?
                            </label>

                            {potentialHosts.length > 0 ? (
                                <div className="grid gap-2">
                                    {potentialHosts.map(host => (
                                        <label
                                            key={host.id}
                                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedHostId === host.id.toString()
                                                ? 'bg-indigo-600/20 border-indigo-500 text-slate-100'
                                                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800 hover:border-slate-600'
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
                                            {selectedHostId === host.id.toString() && <Check className="w-4 h-4 text-indigo-400" />}
                                            <span className="font-medium">{host.name}</span>
                                        </label>
                                    ))}
                                    {potentialHosts.length === 0 && (
                                        <label
                                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedHostId === ''
                                                ? 'bg-indigo-600/20 border-indigo-500 text-slate-100'
                                                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800 hover:border-slate-600'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="host"
                                                value=""
                                                checked={selectedHostId === ''}
                                                onChange={(e) => setSelectedHostId('')}
                                                className="hidden"
                                            />
                                            {selectedHostId === '' && <Check className="w-4 h-4 text-indigo-400" />}
                                            <span className="font-medium">No one / TBD</span>
                                        </label>
                                    )}
                                </div>
                            ) : (
                                <div className="p-3 bg-yellow-900/20 border border-yellow-800 rounded-lg text-yellow-500 text-sm">
                                    No participants marked &quot;I can host&quot; for this slot.
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-indigo-400" />
                                Location / Address
                            </label>
                            <input
                                type="text"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="e.g. 123 Main St, Apt 4B"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                            />
                            <p className="text-xs text-slate-500">
                                This will be sent to attendees and added to calendar invites.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm shadow-lg shadow-indigo-900/20 transition-all flex items-center gap-2"
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

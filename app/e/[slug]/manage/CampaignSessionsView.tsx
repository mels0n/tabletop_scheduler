'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Check, MapPin, User, Loader2, X } from 'lucide-react';

type Voter = {
    participantId: number;
    preference: string;
    canHost: boolean;
    participant: { id: number; name: string };
};

type SlotData = {
    id: number;
    startTime: string;
    hasHost: boolean;
    votes: Voter[];
};

export type SessionGroup = {
    attendees: { id: number; name: string; preference: 'YES' | 'MAYBE' }[];
    coreIds: number[];
    slots: SlotData[];
    meetsQuorum: boolean;
    meetsMinDates: boolean;
    playerCount: number;
    noVotes: boolean;
};

interface Props {
    slug: string;
    groups: SessionGroup[];
    minPlayers: number;
}

export function CampaignSessionsView({ slug, groups, minPlayers }: Props) {
    const router = useRouter();

    // Which group is being finalized (index into groups array)
    const [activeGroup, setActiveGroup] = useState<number | null>(null);
    // Checked slot IDs for the active group (all pre-ticked on selection)
    const [checkedSlots, setCheckedSlots] = useState<number[]>([]);
    // Extra player toggles: slotId → participantId[]
    const [added, setAdded] = useState<Record<number, number[]>>({});
    // Finalize form state
    const [hostId, setHostId] = useState('');
    const [location, setLocation] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectGroup = (i: number) => {
        if (activeGroup === i) {
            // Deselect
            setActiveGroup(null);
            setCheckedSlots([]);
            setHostId('');
            setLocation('');
            return;
        }
        const group = groups[i];
        setActiveGroup(i);
        setCheckedSlots(group.slots.map(s => s.id));
        setAdded({});
        // Auto-select if only one host across all slots
        const hosts = new Map<number, string>();
        for (const slot of group.slots) {
            for (const v of slot.votes) {
                if (v.canHost) hosts.set(v.participantId, v.participant.name);
            }
        }
        const hostKeys = Array.from(hosts.keys());
        setHostId(hostKeys.length === 1 ? String(hostKeys[0]) : '');
        setLocation('');
    };

    const toggleSlot = (slotId: number) => {
        setCheckedSlots(prev =>
            prev.includes(slotId) ? prev.filter(id => id !== slotId) : [...prev, slotId]
        );
    };

    const toggleExtra = (slotId: number, participantId: number) => {
        setAdded(prev => {
            const cur = prev[slotId] ?? [];
            return {
                ...prev,
                [slotId]: cur.includes(participantId)
                    ? cur.filter(id => id !== participantId)
                    : [...cur, participantId],
            };
        });
    };

    const handleFinalize = async () => {
        if (checkedSlots.length === 0 || activeGroup === null) return;
        setIsSubmitting(true);

        // Build the explicit participant list from the active group:
        // core players who are checked in + any extras the DM toggled on per slot.
        const group = groups[activeGroup];
        const coreSet = new Set(group.coreIds);
        const explicitParticipantIds = new Set<number>();

        for (const slotId of checkedSlots) {
            const slot = group.slots.find(s => s.id === slotId);
            if (!slot) continue;
            // Core players available for this slot
            for (const v of slot.votes) {
                if (coreSet.has(v.participantId)) explicitParticipantIds.add(v.participantId);
            }
            // Extras toggled on for this slot
            for (const pid of (added[slotId] ?? [])) {
                explicitParticipantIds.add(pid);
            }
        }

        try {
            const res = await fetch(`/api/event/${slug}/finalize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slotIds: checkedSlots,
                    houseId: hostId || undefined,
                    location: location || undefined,
                    participantIds: Array.from(explicitParticipantIds),
                }),
            });
            if (!res.ok) throw new Error('Failed to finalize');
            router.refresh();
        } catch {
            alert('Something went wrong. Please try again.');
            setIsSubmitting(false);
        }
    };

    if (groups.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                No votes yet. Share the voting link with your players.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Instructions — hidden once a group is selected */}
            {activeGroup === null && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-400">
                    <span className="text-lg leading-none mt-0.5">🎯</span>
                    <div className="space-y-1">
                        <p className="text-slate-300 font-medium">Pick the group you want to run this campaign with</p>
                        <ol className="list-decimal list-inside space-y-0.5 text-slate-500 text-xs">
                            <li>Click any group below to select it — all dates pre-ticked</li>
                            <li>Untick any dates you don&apos;t need</li>
                            <li>Toggle any dimmed names on row 2 to add a guest to that session</li>
                            <li>Set a host and location, then confirm</li>
                        </ol>
                    </div>
                </div>
            )}

            {groups.map((group, i) => {
                const isActive = activeGroup === i;
                const isDimmed = activeGroup !== null && !isActive;
                const coreSet = new Set(group.coreIds);

                // Hosts available across checked slots for this group
                const potentialHosts = new Map<number, string>();
                if (isActive) {
                    for (const slot of group.slots) {
                        if (!checkedSlots.includes(slot.id)) continue;
                        for (const v of slot.votes) {
                            if (v.canHost) potentialHosts.set(v.participantId, v.participant.name);
                        }
                    }
                }

                return (
                    <div
                        key={i}
                        className={`rounded-xl border overflow-hidden transition-all duration-150 ${
                            group.noVotes
                                ? 'border-slate-800/40 bg-slate-900/20 opacity-40'
                                : isActive
                                    ? 'border-indigo-500/60 bg-slate-900/50 ring-1 ring-indigo-500/20'
                                    : isDimmed
                                        ? 'border-slate-800/40 bg-slate-900/30 opacity-40'
                                        : 'border-slate-700/60 bg-slate-900/40 hover:border-slate-600 cursor-pointer'
                        }`}
                    >
                        {/* Group header — click to select */}
                        <div
                            className={`group flex items-start gap-3 px-4 py-3 border-b border-slate-800/50 transition-colors ${
                                !group.noVotes && !isActive ? 'cursor-pointer select-none hover:bg-slate-800/40' : ''
                            } ${isActive ? 'bg-indigo-950/30' : 'bg-slate-900/60'}`}
                            onClick={() => !group.noVotes && selectGroup(i)}
                        >
                            <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                                {group.noVotes ? (
                                    <span className="text-xs text-slate-600 italic">No votes yet for these dates</span>
                                ) : group.attendees.map(p => (
                                    <span
                                        key={p.id}
                                        title={p.preference === 'YES' ? 'Available' : 'If Needed'}
                                        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                                            p.preference === 'YES'
                                                ? 'bg-green-900/25 border-green-800/50 text-green-300'
                                                : 'bg-yellow-900/20 border-yellow-800/40 text-yellow-400'
                                        }`}
                                    >
                                        {p.name}
                                    </span>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 shrink-0 pt-0.5">
                                {isActive && (
                                    <span className="text-[10px] font-bold text-indigo-300 bg-indigo-900/40 border border-indigo-700/50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                        Selecting
                                    </span>
                                )}
                                {!group.noVotes && !isActive && (group.meetsQuorum
                                    ? <span className="text-[10px] font-bold text-green-400 bg-green-900/20 border border-green-900/40 px-1.5 py-0.5 rounded uppercase tracking-wider">Quorum</span>
                                    : <span className="text-[10px] font-bold text-slate-500 bg-slate-800/50 border border-slate-700/40 px-1.5 py-0.5 rounded uppercase tracking-wider">Low T/O</span>
                                )}
                                <span className="text-xs text-slate-500 tabular-nums">
                                    {group.noVotes ? '' : `${group.attendees.length}/${minPlayers} · `}
                                    {isActive ? `${checkedSlots.length} of ${group.slots.length} dates` : `${group.slots.length} date${group.slots.length !== 1 ? 's' : ''}`}
                                </span>
                                {!group.noVotes && !isActive && (
                                    <span className="text-[10px] font-semibold text-indigo-500/70 bg-indigo-950/40 border border-indigo-800/30 px-1.5 py-0.5 rounded ml-1 group-hover:text-indigo-400 transition-colors">
                                        Select →
                                    </span>
                                )}
                                {isActive && (
                                    <button
                                        type="button"
                                        onClick={e => { e.stopPropagation(); selectGroup(i); }}
                                        className="text-slate-500 hover:text-slate-300 transition-colors ml-1"
                                        title="Cancel"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Date rows */}
                        <div className="divide-y divide-slate-800/40">
                            {group.slots.map(slot => {
                                const headerOrder = new Map(group.attendees.map((p, idx) => [p.id, idx]));
                                const byHeader = (a: Voter, b: Voter) =>
                                    (headerOrder.get(a.participantId) ?? 999) - (headerOrder.get(b.participantId) ?? 999);
                                const byPref = (a: Voter, b: Voter) => {
                                    if (a.preference !== b.preference) return a.preference === 'YES' ? -1 : 1;
                                    return a.participant.name.localeCompare(b.participant.name);
                                };
                                const allVoters = slot.votes;
                                const coreVoters = allVoters.filter(v => coreSet.has(v.participantId)).sort(byHeader);
                                const extraVoters = allVoters.filter(v => !coreSet.has(v.participantId)).sort(byPref);
                                const addedIds = added[slot.id] ?? [];
                                const isChecked = checkedSlots.includes(slot.id);

                                return (
                                    <div
                                        key={slot.id}
                                        className={`px-4 py-2 transition-colors ${
                                            isActive && !isChecked ? 'opacity-40' : ''
                                        }`}
                                    >
                                        {/* Row 1: checkbox (if active) + date/time + core players + badges */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {isActive && (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSlot(slot.id)}
                                                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                                        isChecked ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 hover:border-slate-400'
                                                    }`}
                                                >
                                                    {isChecked && <Check className="w-2.5 h-2.5 text-white" />}
                                                </button>
                                            )}
                                            <div className="text-sm shrink-0 mr-1">
                                                <span className="font-medium text-slate-200" suppressHydrationWarning>
                                                    {format(new Date(slot.startTime), 'EEE, MMM d')}
                                                </span>
                                                <span className="text-slate-500 mx-1.5">@</span>
                                                <span className="text-slate-300" suppressHydrationWarning>
                                                    {format(new Date(slot.startTime), 'h:mm a')}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1 flex-1">
                                                {coreVoters.map(v => (
                                                    <span
                                                        key={v.participantId}
                                                        title={v.preference === 'YES' ? 'Available' : 'If Needed'}
                                                        className={`text-xs px-1.5 py-0.5 rounded border font-medium whitespace-nowrap ${
                                                            v.preference === 'YES'
                                                                ? 'bg-green-900/25 border-green-800/50 text-green-300'
                                                                : 'bg-yellow-900/20 border-yellow-800/40 text-yellow-400'
                                                        }`}
                                                    >
                                                        {v.participant.name}
                                                    </span>
                                                ))}
                                            </div>
                                            {/* Per-date badges */}
                                            {slot.hasHost
                                                ? <span className="text-[10px] font-bold text-indigo-400 bg-indigo-900/20 border border-indigo-900/40 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">Host ✓</span>
                                                : <span className="text-[10px] font-bold text-orange-500/70 bg-orange-900/10 border border-orange-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">No Host</span>
                                            }
                                        </div>

                                        {/* Row 2: extra players available this date only — click to add */}
                                        {extraVoters.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                                                <span className="text-[10px] text-slate-600 mr-0.5 shrink-0">also free:</span>
                                                {extraVoters.map(v => {
                                                    const isOn = addedIds.includes(v.participantId);
                                                    return (
                                                        <button
                                                            key={v.participantId}
                                                            type="button"
                                                            onClick={() => toggleExtra(slot.id, v.participantId)}
                                                            title={isOn ? `Remove ${v.participant.name}` : `Add ${v.participant.name} to this session`}
                                                            className={`text-xs px-1.5 py-0.5 rounded border font-medium whitespace-nowrap transition-all ${
                                                                isOn
                                                                    ? v.preference === 'YES'
                                                                        ? 'bg-green-900/25 border-green-800/50 text-green-300'
                                                                        : 'bg-yellow-900/20 border-yellow-800/40 text-yellow-400'
                                                                    : 'opacity-35 border-slate-700 text-slate-400 hover:opacity-60 hover:border-slate-500'
                                                            }`}
                                                        >
                                                            {isOn ? '' : '+'}{v.participant.name}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Inline finalize panel — only shown when group is selected */}
                        {isActive && (
                            <div className="border-t border-indigo-800/40 bg-indigo-950/20 px-4 py-4 space-y-4">

                                {/* Host selector */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                        <User className="w-4 h-4 text-indigo-400" />
                                        Who is hosting?
                                        <span className="text-xs text-slate-500 font-normal">(applies to all sessions)</span>
                                    </label>
                                    {potentialHosts.size > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {Array.from(potentialHosts.entries()).map(([id, name]) => (
                                                <label
                                                    key={id}
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-all ${
                                                        hostId === String(id)
                                                            ? 'bg-indigo-600/20 border-indigo-500 text-slate-100'
                                                            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                                                    }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name={`host-${i}`}
                                                        value={id}
                                                        checked={hostId === String(id)}
                                                        onChange={() => setHostId(String(id))}
                                                        className="hidden"
                                                    />
                                                    {hostId === String(id) && <Check className="w-3 h-3 text-indigo-400" />}
                                                    {name}
                                                </label>
                                            ))}
                                            <label
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-all ${
                                                    hostId === ''
                                                        ? 'bg-indigo-600/20 border-indigo-500 text-slate-100'
                                                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                                                }`}
                                            >
                                                <input type="radio" name={`host-${i}`} value="" checked={hostId === ''} onChange={() => setHostId('')} className="hidden" />
                                                {hostId === '' && <Check className="w-3 h-3 text-indigo-400" />}
                                                TBD
                                            </label>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-yellow-600/80 bg-yellow-900/10 border border-yellow-900/30 rounded-lg px-3 py-2">
                                            No one volunteered to host for the selected dates.
                                        </p>
                                    )}
                                </div>

                                {/* Location */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-indigo-400" />
                                        Location
                                        <span className="text-xs text-slate-500 font-normal">(optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={location}
                                        onChange={e => setLocation(e.target.value)}
                                        placeholder="e.g. 123 Main St, Game Room B"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
                                    />
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-between gap-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => selectGroup(i)}
                                        className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                                        disabled={isSubmitting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleFinalize}
                                        disabled={isSubmitting || checkedSlots.length === 0}
                                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm shadow-lg shadow-indigo-900/20 transition-all flex items-center gap-2"
                                    >
                                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                        Confirm {checkedSlots.length} Session{checkedSlots.length !== 1 ? 's' : ''}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

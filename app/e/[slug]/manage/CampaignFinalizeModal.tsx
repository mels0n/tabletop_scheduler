'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { X, MapPin, User, Check, Loader2, Calendar, ChevronDown, ChevronRight, Info, AlertTriangle } from 'lucide-react';
import { ClientDate, ClientTimezone } from '@/components/ClientDate';

interface SlotVote {
    participantId: number;
    preference: string;
    participant: { id: number; name: string };
}

interface Slot {
    id: number;
    startTime: Date;
    endTime: Date;
    yesCount: number;
    maybeCount: number;
    noCount: number;
    viable: boolean;
    perfect: boolean;
    potentialHosts: Array<{ id: number; name: string }>;
    votes: SlotVote[];
}

interface CampaignFinalizeModalProps {
    slug: string;
    minSessions: number;
    slots: Slot[];
}

export function CampaignFinalizeModal({ slug, minSessions, slots }: CampaignFinalizeModalProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedSlotIds, setSelectedSlotIds] = useState<Set<number>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSlotTooltip, setShowSlotTooltip] = useState(false);
    const [showPlayerTooltip, setShowPlayerTooltip] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
    const [address, setAddress] = useState('');
    const router = useRouter();

    // Collect all potential hosts across every slot (deduplicated)
    const potentialHosts = useMemo(() => {
        const map = new Map<number, { id: number; name: string }>();
        for (const slot of slots) {
            for (const host of slot.potentialHosts) map.set(host.id, host);
        }
        return Array.from(map.values());
    }, [slots]);

    const [hostId, setHostId] = useState(() =>
        potentialHosts.length === 1 ? potentialHosts[0].id.toString() : ''
    );

    // Player grouping: count how many sessions each player can attend.
    // When nothing is selected yet, show across ALL slots so the host can
    // use this info to decide which sessions to pick.
    const playerGroupings = useMemo(() => {
        const activeSlotsForGrouping = selectedSlotIds.size > 0
            ? slots.filter(s => selectedSlotIds.has(s.id))
            : slots;

        const playerMap = new Map<number, { name: string; count: number }>();
        for (const slot of activeSlotsForGrouping) {
            for (const vote of slot.votes) {
                if (vote.preference === 'YES' || vote.preference === 'MAYBE') {
                    const entry = playerMap.get(vote.participantId);
                    if (entry) {
                        entry.count++;
                    } else {
                        playerMap.set(vote.participantId, { name: vote.participant.name, count: 1 });
                    }
                }
            }
        }

        const groupMap: Record<number, string[]> = {};
        playerMap.forEach(({ name, count }) => {
            if (!groupMap[count]) groupMap[count] = [];
            groupMap[count].push(name);
        });
        Object.values(groupMap).forEach(names => names.sort());

        return {
            groups: Object.entries(groupMap)
                .map(([k, names]) => ({ count: parseInt(k), total: activeSlotsForGrouping.length, names }))
                .sort((a, b) => b.count - a.count),
            isFiltered: selectedSlotIds.size > 0,
            total: activeSlotsForGrouping.length,
        };
    }, [selectedSlotIds, slots]);

    const sessionCount = selectedSlotIds.size;
    const belowTarget = sessionCount > 0 && sessionCount < minSessions;

    const toggleSlot = (id: number) =>
        setSelectedSlotIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    const toggleGroup = (count: number) =>
        setExpandedGroups(prev => {
            const next = new Set(prev);
            next.has(count) ? next.delete(count) : next.add(count);
            return next;
        });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (sessionCount === 0) return;
        setIsSubmitting(true);

        try {
            const res = await fetch(`/api/event/${slug}/finalize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slotIds: Array.from(selectedSlotIds),
                    houseId: hostId || undefined,
                    location: address || undefined,
                }),
            });

            if (!res.ok) throw new Error('Failed to finalize campaign');

            setIsOpen(false);
            router.refresh();
        } catch {
            alert('Something went wrong. Please try again.');
            setIsSubmitting(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-900/30 transition-all"
            >
                <Calendar className="w-4 h-4" />
                Finalize Campaign Sessions
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-semibold text-slate-100">Finalize Campaign</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Select sessions to lock in, then confirm your group</p>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-200 p-1 rounded-full hover:bg-slate-800 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-6">

                    {/* ── SESSION SELECTION ── */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-indigo-400" />
                                Select Sessions to Lock In
                            </span>
                            <div className="relative">
                                <button
                                    type="button"
                                    onMouseEnter={() => setShowSlotTooltip(true)}
                                    onMouseLeave={() => setShowSlotTooltip(false)}
                                    className="text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    <Info className="w-3.5 h-3.5" />
                                </button>
                                {showSlotTooltip && (
                                    <div className="absolute left-0 bottom-6 w-64 bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs text-slate-300 shadow-xl z-10">
                                        Select all the sessions you want to schedule. Players are confirmed based on their overall availability across your chosen sessions.
                                    </div>
                                )}
                            </div>
                            <span className="ml-auto text-xs text-slate-500">
                                {sessionCount} of {minSessions} target sessions selected
                            </span>
                        </div>

                        {belowTarget && (
                            <div className="flex items-start gap-2 p-3 bg-yellow-900/20 border border-yellow-800/50 rounded-lg text-yellow-400 text-xs">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>You set a target of {minSessions} sessions. You can still finalize with fewer — this is just a reminder.</span>
                            </div>
                        )}

                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {slots.map(slot => {
                                const isSelected = selectedSlotIds.has(slot.id);
                                return (
                                    <label
                                        key={slot.id}
                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                            isSelected
                                                ? 'bg-indigo-600/15 border-indigo-500/60'
                                                : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
                                        }`}
                                    >
                                        <input type="checkbox" checked={isSelected} onChange={() => toggleSlot(slot.id)} className="hidden" />
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'}`}>
                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm text-slate-200">
                                                <ClientDate date={slot.startTime} formatStr="EEE, MMM d" />
                                                <ClientDate date={slot.startTime} formatStr="h:mm a" className="text-slate-400 font-normal ml-2" />
                                                <ClientTimezone className="ml-1 text-slate-500 font-normal" />
                                            </div>
                                            <div className="flex gap-3 mt-0.5 text-xs">
                                                <span
                                                    className="text-green-400 cursor-help"
                                                    title={slot.votes.filter(v => v.preference === 'YES').map(v => v.participant.name).join(', ') || 'No Yes votes'}
                                                >
                                                    {slot.yesCount} Yes
                                                </span>
                                                <span
                                                    className="text-yellow-500/80 cursor-help"
                                                    title={slot.votes.filter(v => v.preference === 'MAYBE').map(v => v.participant.name).join(', ') || 'None'}
                                                >
                                                    {slot.maybeCount} If Needed
                                                </span>
                                                <span
                                                    className="text-red-900/60 cursor-help"
                                                    title={slot.votes.filter(v => v.preference === 'NO').map(v => v.participant.name).join(', ') || 'None'}
                                                >
                                                    {slot.noCount} No
                                                </span>
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            {slot.perfect && <span className="text-[10px] font-bold text-green-400 bg-green-900/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Perfect</span>}
                                            {slot.viable && !slot.perfect && <span className="text-[10px] font-bold text-indigo-400 bg-indigo-900/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Viable</span>}
                                            {!slot.viable && <span className="text-[10px] font-bold text-slate-600 bg-slate-800/50 px-1.5 py-0.5 rounded uppercase tracking-wider">Low T/O</span>}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── PLAYER AVAILABILITY GROUPING ── */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                <User className="w-4 h-4 text-indigo-400" />
                                Who Can Attend
                            </span>
                            <div className="relative">
                                <button
                                    type="button"
                                    onMouseEnter={() => setShowPlayerTooltip(true)}
                                    onMouseLeave={() => setShowPlayerTooltip(false)}
                                    className="text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    <Info className="w-3.5 h-3.5" />
                                </button>
                                {showPlayerTooltip && (
                                    <div className="absolute left-0 bottom-6 w-64 bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs text-slate-300 shadow-xl z-10">
                                        Shows how many sessions each player can attend (YES or If Needed). Check sessions above to see how your group changes — use this to find your core group.
                                    </div>
                                )}
                            </div>
                            <span className="ml-auto text-xs text-slate-500">
                                {playerGroupings.isFiltered
                                    ? `across ${playerGroupings.total} selected session${playerGroupings.total !== 1 ? 's' : ''}`
                                    : `across all ${playerGroupings.total} candidate session${playerGroupings.total !== 1 ? 's' : ''}`
                                }
                            </span>
                        </div>

                        {playerGroupings.groups.length === 0 ? (
                            <p className="text-sm text-slate-500 italic pl-1">No votes yet — share the voting link with your players.</p>
                        ) : (
                            <div className="bg-slate-950/50 rounded-lg border border-slate-800 divide-y divide-slate-800/50">
                                {playerGroupings.groups.map(({ count, total, names }) => (
                                    <div key={count}>
                                        <button
                                            type="button"
                                            onClick={() => toggleGroup(count)}
                                            className="w-full flex items-center gap-2 text-left px-3 py-2.5 hover:bg-slate-800/40 transition-colors"
                                        >
                                            {expandedGroups.has(count)
                                                ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                : <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                            }
                                            <span className={`text-sm font-semibold tabular-nums ${
                                                count === total ? 'text-green-400' :
                                                count >= Math.ceil(total * 0.7) ? 'text-indigo-300' : 'text-slate-400'
                                            }`}>
                                                {count}/{total}
                                            </span>
                                            <span className="text-sm text-slate-400">sessions</span>
                                            {count === total && (
                                                <span className="text-[10px] font-bold text-green-400 bg-green-900/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Core</span>
                                            )}
                                            <span className="text-xs text-slate-600 ml-auto">
                                                {names.length} player{names.length !== 1 ? 's' : ''}
                                            </span>
                                        </button>
                                        {expandedGroups.has(count) && (
                                            <div className="px-8 pb-2.5 flex flex-wrap gap-1.5">
                                                {names.map(name => (
                                                    <span key={name} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700/80">
                                                        {name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── HOST SELECTION ── */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                            <User className="w-4 h-4 text-indigo-400" />
                            Who is hosting?
                            <span className="text-xs text-slate-500 font-normal">(applies to all sessions)</span>
                        </label>
                        {potentialHosts.length > 0 ? (
                            <div className="grid gap-2">
                                {potentialHosts.map(host => (
                                    <label
                                        key={host.id}
                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                            hostId === host.id.toString()
                                                ? 'bg-indigo-600/20 border-indigo-500 text-slate-100'
                                                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800 hover:border-slate-600'
                                        }`}
                                    >
                                        <input type="radio" name="host" value={host.id} checked={hostId === host.id.toString()} onChange={e => setHostId(e.target.value)} className="hidden" />
                                        {hostId === host.id.toString() && <Check className="w-4 h-4 text-indigo-400" />}
                                        <span className="font-medium">{host.name}</span>
                                    </label>
                                ))}
                                <label
                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                        hostId === ''
                                            ? 'bg-indigo-600/20 border-indigo-500 text-slate-100'
                                            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800 hover:border-slate-600'
                                    }`}
                                >
                                    <input type="radio" name="host" value="" checked={hostId === ''} onChange={() => setHostId('')} className="hidden" />
                                    {hostId === '' && <Check className="w-4 h-4 text-indigo-400" />}
                                    <span className="font-medium">No one / TBD</span>
                                </label>
                            </div>
                        ) : (
                            <div className="p-3 bg-yellow-900/20 border border-yellow-800 rounded-lg text-yellow-500 text-sm">
                                No participants marked &quot;I can host&quot; for any slot.
                            </div>
                        )}
                    </div>

                    {/* ── LOCATION ── */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-indigo-400" />
                            Location / Address
                            <span className="text-xs text-slate-500 font-normal">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                            placeholder="e.g. 123 Main St, Game Room B"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                        />
                        <p className="text-xs text-slate-500">Added to calendar invites for all sessions and sent to attendees.</p>
                    </div>
                </form>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 flex justify-between items-center gap-3 shrink-0">
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
                        form="campaign-finalize-form"
                        onClick={handleSubmit}
                        disabled={isSubmitting || sessionCount === 0}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm shadow-lg shadow-indigo-900/20 transition-all flex items-center gap-2"
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        Confirm {sessionCount > 0 ? `${sessionCount} Session${sessionCount !== 1 ? 's' : ''}` : 'Sessions'}
                    </button>
                </div>
            </div>
        </div>
    );
}

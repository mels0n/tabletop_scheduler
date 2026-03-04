"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Edit2, Plus, X } from "lucide-react";

interface Slot {
    id: number;
    startTime: Date;
    endTime: Date;
}

interface ManageSlotsProps {
    slug: string;
    slots: Slot[];
}

function formatDateForInput(dateStr: Date | string) {
    const d = new Date(dateStr);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ManageSlots({ slug, slots }: ManageSlotsProps) {
    const router = useRouter();
    const [loadingId, setLoadingId] = useState<number | null>(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    // Edit State
    const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
    const [editStart, setEditStart] = useState("");
    const [editEnd, setEditEnd] = useState("");

    // Add State
    const [isAdding, setIsAdding] = useState(false);
    const [addStart, setAddStart] = useState("");
    const [addEnd, setAddEnd] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const clearMessages = () => {
        setErrorMsg("");
        setSuccessMsg("");
    };

    const handleDelete = async (slotId: number) => {
        if (!confirm("Are you sure? This will wipe all existing votes for this time slot.")) return;

        clearMessages();
        setLoadingId(slotId);
        try {
            const res = await fetch(`/api/event/${slug}/slot/${slotId}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to delete slot");

            setSuccessMsg("Time slot deleted successfully.");
            router.refresh();
        } catch (error: any) {
            setErrorMsg(error.message);
        } finally {
            setLoadingId(null);
        }
    };

    const handleSaveEdit = async () => {
        if (!editingSlotId) return;
        if (!editStart || !editEnd) {
            setErrorMsg("Start and End times are required.");
            return;
        }

        if (!confirm("Editing this time will wipe all existing votes for it. Continue?")) return;

        clearMessages();
        setIsSaving(true);
        try {
            const res = await fetch(`/api/event/${slug}/slot/${editingSlotId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ startTime: editStart, endTime: editEnd })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update slot");

            setSuccessMsg("Time slot updated successfully.");
            setEditingSlotId(null);
            router.refresh();
        } catch (error: any) {
            setErrorMsg(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAdd = async () => {
        if (!addStart || !addEnd) {
            setErrorMsg("Start and End times are required.");
            return;
        }

        clearMessages();
        setIsSaving(true);
        try {
            const res = await fetch(`/api/event/${slug}/slot`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ startTime: addStart, endTime: addEnd })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to add slot");

            setSuccessMsg("Time slot added successfully.");
            setIsAdding(false);
            setAddStart("");
            setAddEnd("");
            router.refresh();
        } catch (error: any) {
            setErrorMsg(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-300">Manage Times</h3>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
                    >
                        <Plus size={14} /> Add
                    </button>
                )}
            </div>

            {errorMsg && (
                <div className="p-3 bg-red-900/30 border border-red-900/50 rounded-lg text-sm text-red-400">
                    {errorMsg}
                </div>
            )}

            {successMsg && (
                <div className="p-3 bg-green-900/30 border border-green-900/50 rounded-lg text-sm text-green-400">
                    {successMsg}
                </div>
            )}

            {isAdding && (
                <div className="p-4 bg-slate-800/40 border border-slate-700 rounded-xl space-y-3">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-slate-200">New Time Option</span>
                        <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-200"><X size={16} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Start Time</label>
                            <input
                                type="datetime-local"
                                value={addStart}
                                onChange={(e) => setAddStart(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">End Time</label>
                            <input
                                type="datetime-local"
                                value={addEnd}
                                onChange={(e) => setAddEnd(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleAdd}
                        disabled={isSaving}
                        className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-2 rounded font-medium disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin inline mr-2" /> : "Save New Option"}
                    </button>
                </div>
            )}

            <div className="space-y-3 mt-4">
                {slots.map(slot => (
                    <div key={slot.id} className="p-3 bg-slate-800/20 border border-slate-800 rounded-lg flex flex-col gap-2">
                        {editingSlotId === slot.id ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Start Time</label>
                                        <input
                                            type="datetime-local"
                                            value={editStart}
                                            onChange={(e) => setEditStart(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">End Time</label>
                                        <input
                                            type="datetime-local"
                                            value={editEnd}
                                            onChange={(e) => setEditEnd(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSaveEdit}
                                        disabled={isSaving}
                                        className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs py-2 rounded font-medium disabled:opacity-50"
                                    >
                                        {isSaving ? <Loader2 size={14} className="animate-spin inline" /> : "Save"}
                                    </button>
                                    <button
                                        onClick={() => setEditingSlotId(null)}
                                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-xs py-2 rounded font-medium"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-slate-300">
                                    {new Date(slot.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                    <span className="text-slate-500 mx-2">to</span>
                                    {new Date(slot.endTime).toLocaleString([], { timeStyle: 'short' })}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => {
                                            setEditingSlotId(slot.id);
                                            setEditStart(formatDateForInput(slot.startTime));
                                            setEditEnd(formatDateForInput(slot.endTime));
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-indigo-400 bg-slate-800 hover:bg-indigo-900/30 rounded transition-colors"
                                        title="Edit Slot"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(slot.id)}
                                        disabled={loadingId === slot.id}
                                        className="p-1.5 text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
                                        title="Delete Slot"
                                    >
                                        {loadingId === slot.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

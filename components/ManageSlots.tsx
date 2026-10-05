"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Edit2, Plus, X } from "lucide-react";
import { DateTimeRangeInputs } from "./DateTimeRangeInputs";
import { ClientDate, ClientTimezone } from "./ClientDate";

interface Slot {
    id: number;
    startTime: Date;
    endTime: Date;
}

interface ManageSlotsProps {
    slug: string;
    slots: Slot[];
}

function getDateString(dateStr: Date | string) {
    const d = new Date(dateStr);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getTimeString(dateStr: Date | string) {
    const d = new Date(dateStr);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ManageSlots({ slug, slots }: ManageSlotsProps) {
    const router = useRouter();
    const [loadingId, setLoadingId] = useState<number | null>(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    // Edit State
    const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
    const [editDate, setEditDate] = useState("");
    const [editStart, setEditStart] = useState("");
    const [editEnd, setEditEnd] = useState("");

    // Add State
    const [isAdding, setIsAdding] = useState(false);
    const [addDate, setAddDate] = useState("");
    const [addStart, setAddStart] = useState("18:00");
    const [addEnd, setAddEnd] = useState("22:00");
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
        if (!editDate || !editStart || !editEnd) {
            setErrorMsg("Date, Start, and End times are required.");
            return;
        }

        const startDateTime = new Date(`${editDate}T${editStart}:00`);
        let endDateTime = new Date(`${editDate}T${editEnd}:00`);
        if (endDateTime <= startDateTime) {
            endDateTime = new Date(endDateTime.getTime() + 24 * 60 * 60 * 1000);
        }

        if (!confirm("Editing this time will wipe all existing votes for it. Continue?")) return;

        clearMessages();
        setIsSaving(true);
        try {
            const res = await fetch(`/api/event/${slug}/slot/${editingSlotId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ startTime: startDateTime.toISOString(), endTime: endDateTime.toISOString() })
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
        if (!addDate || !addStart || !addEnd) {
            setErrorMsg("Date, Start, and End times are required.");
            return;
        }

        const startDateTime = new Date(`${addDate}T${addStart}:00`);
        let endDateTime = new Date(`${addDate}T${addEnd}:00`);
        if (endDateTime <= startDateTime) {
            endDateTime = new Date(endDateTime.getTime() + 24 * 60 * 60 * 1000);
        }

        if (startDateTime < new Date()) {
            setErrorMsg("You cannot schedule events in the past.");
            return;
        }

        clearMessages();
        setIsSaving(true);
        try {
            const res = await fetch(`/api/event/${slug}/slot`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ startTime: startDateTime.toISOString(), endTime: endDateTime.toISOString() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to add slot");

            setSuccessMsg("Time slot added successfully.");
            setIsAdding(false);
            setAddDate("");
            setAddStart("18:00");
            setAddEnd("22:00");
            router.refresh();
        } catch (error: any) {
            setErrorMsg(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-surface p-6 rounded-card border border-line space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-parchment-2">Manage Times</h3>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="text-xs bg-gold hover:bg-gold-bright text-on-gold px-3 py-1.5 rounded-control flex items-center gap-1 transition-colors"
                    >
                        <Plus size={14} /> Add
                    </button>
                )}
            </div>

            {errorMsg && (
                <div className="p-3 bg-no-bg border border-no rounded-control text-sm text-no">
                    {errorMsg}
                </div>
            )}

            {successMsg && (
                <div className="p-3 bg-yes-bg border border-yes rounded-control text-sm text-yes">
                    {successMsg}
                </div>
            )}

            {isAdding && (
                <div className="p-4 bg-surface-2 border border-line-strong rounded-card space-y-3">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-parchment">New Time Option</span>
                        <button onClick={() => setIsAdding(false)} className="text-mist hover:text-parchment"><X size={16} /></button>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <DateTimeRangeInputs
                            date={addDate} setDate={setAddDate}
                            start={addStart} setStart={setAddStart}
                            end={addEnd} setEnd={setAddEnd}
                        />
                    </div>
                    <button
                        onClick={handleAdd}
                        disabled={isSaving}
                        className="w-full mt-2 bg-gold hover:bg-gold-bright text-on-gold text-sm py-2 rounded-control font-medium disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin inline mr-2" /> : "Save New Option"}
                    </button>
                </div>
            )}

            <div className="space-y-3 mt-4">
                {slots.map(slot => (
                    <div key={slot.id} className="p-3 bg-surface-2 border border-line rounded-control flex flex-col gap-2">
                        {editingSlotId === slot.id ? (
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-4">
                                    <DateTimeRangeInputs
                                        date={editDate} setDate={setEditDate}
                                        start={editStart} setStart={setEditStart}
                                        end={editEnd} setEnd={setEditEnd}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSaveEdit}
                                        disabled={isSaving}
                                        className="flex-1 bg-yes hover:bg-yes/90 text-on-yes text-xs py-2 rounded-control font-medium disabled:opacity-50"
                                    >
                                        {isSaving ? <Loader2 size={14} className="animate-spin inline" /> : "Save"}
                                    </button>
                                    <button
                                        onClick={() => setEditingSlotId(null)}
                                        className="flex-1 border border-line-strong hover:bg-surface text-parchment text-xs py-2 rounded-control font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-parchment-2">
                                    <ClientDate date={slot.startTime} formatStr="P, p" />
                                    <span className="text-mist mx-2">to</span>
                                    <ClientDate date={slot.endTime} formatStr="p" />
                                    <ClientTimezone className="ml-1 text-mist" />
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => {
                                            setEditingSlotId(slot.id);
                                            setEditDate(getDateString(slot.startTime));
                                            setEditStart(getTimeString(slot.startTime));
                                            setEditEnd(getTimeString(slot.endTime));
                                        }}
                                        className="p-1.5 text-mist hover:text-gold-bright hover:bg-surface rounded-control transition-colors"
                                        title="Edit Slot"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(slot.id)}
                                        disabled={loadingId === slot.id}
                                        className="p-1.5 text-mist hover:text-no hover:bg-no-bg rounded-control transition-colors disabled:opacity-50"
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

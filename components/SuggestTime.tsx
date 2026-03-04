"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CalendarPlus, X } from "lucide-react";
import { DateTimeRangeInputs } from "./DateTimeRangeInputs";

interface SuggestTimeProps {
    slug: string;
    serverParticipantId?: number;
    participants: { id: number; name: string }[];
}

export function SuggestTime({ slug, serverParticipantId, participants }: SuggestTimeProps) {
    const router = useRouter();
    const [isExpanded, setIsExpanded] = useState(false);
    const [date, setDate] = useState("");
    const [start, setStart] = useState("18:00");
    const [end, setEnd] = useState("22:00");
    const [name, setName] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    // Attempt to pre-fill name if we know who they are
    useEffect(() => {
        if (serverParticipantId) {
            const p = participants.find(p => p.id === serverParticipantId);
            if (p) setName(p.name);
        } else {
            const lsName = localStorage.getItem("tabletop_user_name");
            if (lsName) setName(lsName);
        }
    }, [serverParticipantId, participants]);

    const handleSuggest = async () => {
        if (!date || !start || !end || !name.trim()) {
            setErrorMsg("Please fill in all fields.");
            return;
        }

        const startDateTime = new Date(`${date}T${start}:00`);
        const endDateTime = new Date(`${date}T${end}:00`);
        const now = new Date();

        if (startDateTime < now) {
            setErrorMsg("You cannot suggest a time in the past.");
            return;
        }

        if (endDateTime <= startDateTime) {
            setErrorMsg("End time must be after start time.");
            return;
        }

        setErrorMsg("");
        setIsSaving(true);
        try {
            const res = await fetch(`/api/event/${slug}/slot/suggest`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    startTime: startDateTime.toISOString(),
                    endTime: endDateTime.toISOString(),
                    suggesterName: name.trim()
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to suggest time.");

            localStorage.setItem("tabletop_user_name", name.trim());
            setSuccessMsg("Time suggested successfully! It has been added to the voting grid.");
            setDate("");
            setStart("18:00");
            setEnd("22:00");
            setTimeout(() => {
                setIsExpanded(false);
                setSuccessMsg("");
            }, 3000);
            router.refresh();

        } catch (error: any) {
            setErrorMsg(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isExpanded) {
        return (
            <div className="mt-8 text-center pt-8 border-t border-slate-800">
                <button
                    onClick={() => setIsExpanded(true)}
                    className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors text-sm font-medium border border-indigo-900/50 bg-indigo-900/20 px-4 py-2 rounded-lg"
                >
                    <CalendarPlus size={16} />
                    Propose Another Time
                </button>
            </div>
        );
    }

    return (
        <div className="mt-8 pt-8 border-t border-slate-800">
            <div className="max-w-md mx-auto bg-slate-900/80 p-6 rounded-2xl border border-indigo-900/50 relative shadow-xl">
                <button
                    onClick={() => setIsExpanded(false)}
                    className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
                >
                    <X size={18} />
                </button>

                <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                    <CalendarPlus className="text-indigo-400" size={20} />
                    Suggest a Time
                </h3>

                {errorMsg && (
                    <div className="mb-4 p-3 bg-red-900/30 border border-red-900/50 rounded-lg text-sm text-red-400">
                        {errorMsg}
                    </div>
                )}
                {successMsg && (
                    <div className="mb-4 p-3 bg-green-900/30 border border-green-900/50 rounded-lg text-sm text-green-400">
                        {successMsg}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Your Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="How should we identify you?"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <DateTimeRangeInputs
                            date={date} setDate={setDate}
                            start={start} setStart={setStart}
                            end={end} setEnd={setEnd}
                        />
                    </div>

                    <button
                        onClick={handleSuggest}
                        disabled={isSaving}
                        className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20"
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : "Submit Suggestion"}
                    </button>
                    <p className="text-xs text-slate-500 text-center mt-3">
                        This option will be added to the voting board immediately, and a notification will be sent to the group.
                    </p>
                </div>
            </div>
        </div>
    );
}

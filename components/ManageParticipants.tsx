"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ManageParticipantsProps {
    slug: string;
    participants: {
        id: string;
        name: string;
        telegramId?: string | null;
    }[];
}

export function ManageParticipants({ slug, participants }: ManageParticipantsProps) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleDelete = async (participantId: string, participantName: string) => {
        if (!confirm(`Are you sure you want to remove ${participantName} and all their votes from this event?`)) {
            return;
        }

        setIsDeleting(participantId);
        setMessage(null);

        try {
            const response = await fetch(`/api/event/${slug}/participant/${participantId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to remove participant");
            }

            setMessage({ type: "success", text: `${participantName} has been removed.` });
            router.refresh();

            // Clear success message after 3 seconds
            setTimeout(() => setMessage(null), 3000);
        } catch (error: any) {
            console.error(error);
            setMessage({ type: "error", text: error.message || "Failed to remove participant." });
        } finally {
            setIsDeleting(null);
        }
    };

    if (participants.length === 0) {
        return null;
    }

    return (
        <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 mt-8">
            <h3 className="text-lg font-semibold text-slate-300 mb-4 flex items-center justify-between">
                <span>Manage Participants</span>
                <span className="bg-slate-800 text-slate-400 px-2 py-1 rounded text-xs">
                    {participants.length}
                </span>
            </h3>

            {message && (
                <div className={`mb-4 px-3 py-2 rounded text-sm ${message.type === 'success' ? 'bg-green-900/30 text-green-400 border border-green-900/50' : 'bg-red-900/30 text-red-400 border border-red-900/50'}`}>
                    {message.text}
                </div>
            )}

            <ul className="space-y-3">
                {participants.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800/50">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs ring-2 ring-slate-900">
                                {p.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <div className="font-medium text-slate-200">
                                    {p.name}
                                    {p.telegramId && <span className="ml-2 text-xs text-indigo-400 font-normal">{p.telegramId}</span>}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => handleDelete(p.id, p.name)}
                            disabled={isDeleting === p.id}
                            className="px-2 py-1 text-xs text-red-400 hover:bg-red-950/30 hover:text-red-300 rounded border border-transparent hover:border-red-900/50 transition-colors disabled:opacity-50"
                            title="Remove participant and their votes"
                        >
                            {isDeleting === p.id ? "Removing..." : "Remove"}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

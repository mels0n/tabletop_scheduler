"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ManageParticipant } from "@/features/event-management/model/dto";

interface ManageParticipantsProps {
    slug: string;
    participants: ManageParticipant[];
}

export function ManageParticipants({ slug, participants }: ManageParticipantsProps) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState<number | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleDelete = async (participantId: number, participantName: string) => {
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
            console.error("Failed to remove participant", error);
            setMessage({ type: "error", text: error.message || "Failed to remove participant." });
        } finally {
            setIsDeleting(null);
        }
    };

    if (participants.length === 0) {
        return null;
    }

    return (
        <div className="bg-surface p-6 rounded-card border border-line">
            <h3 className="text-lg font-semibold text-parchment-2 mb-4 flex items-center justify-between">
                <span>Manage Participants</span>
                <span className="bg-surface-2 text-parchment-2 px-2 py-1 rounded-[3px] text-xs">
                    {participants.length}
                </span>
            </h3>

            {message && (
                <div className={`mb-4 px-3 py-2 rounded-control text-sm ${message.type === 'success' ? 'bg-yes-bg text-yes border border-yes' : 'bg-no-bg text-no border border-no'}`}>
                    {message.text}
                </div>
            )}

            <ul className="space-y-3">
                {participants.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-control bg-field border border-line">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-control bg-surface-2 flex items-center justify-center text-gold-bright font-bold text-xs">
                                {p.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <div className="font-medium text-parchment">
                                    {p.name}
                                    {p.telegramHandle && <span className="ml-2 text-xs text-gold-bright font-normal">{p.telegramHandle}</span>}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => handleDelete(p.id, p.name)}
                            disabled={isDeleting === p.id}
                            className="px-2 py-1 text-xs text-no hover:bg-no-bg rounded-control border border-transparent hover:border-no transition-colors disabled:opacity-50"
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

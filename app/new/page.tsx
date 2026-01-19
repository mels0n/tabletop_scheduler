"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { TimeSlotPicker, TimeSlot } from "@/components/TimeSlotPicker";
import { Loader2 } from "lucide-react";

/**
 * @component NewEventPage
 * @description The Event Creation Wizard.
 *
 * User Flow:
 * 1. User inputs Title, Description, and Min Players.
 * 2. User selects multiple Time Slots via `TimeSlotPicker`.
 * 3. On Submit:
 *    - POST /api/event creates the event.
 *    - Server returns an `adminToken`.
 *    - Client calls Server Action `setAdminCookie` to save this token securely.
 *    - Redirects to the new Management Dashboard.
 */
// Basic wrapper to support useSearchParams without de-opting static generation where unnecessary
export default function NewEventPage() {
    return (
        <Suspense fallback={<Loader2 className="animate-spin text-white" />}>
            <NewEventForm />
        </Suspense>
    );
}

function NewEventForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const searchParams = useSearchParams();

    // Intent: Pre-fill from URL params for easier "Reuse" or "Template" links
    const [title, setTitle] = useState(searchParams.get("title") || "");
    const [description, setDescription] = useState(searchParams.get("description") || "");
    const [minPlayers, setMinPlayers] = useState(parseInt(searchParams.get("minPlayers") || "3"));
    const [maxPlayers, setMaxPlayers] = useState<number | null>(
        searchParams.get("maxPlayers") ? parseInt(searchParams.get("maxPlayers")!) : null
    );
    const [slots, setSlots] = useState<TimeSlot[]>(() => {
        const slotsParam = searchParams.get("slots");
        if (slotsParam) {
            try {
                const parsed = JSON.parse(slotsParam);
                if (Array.isArray(parsed)) {
                    return parsed.map((s: any) => ({
                        id: crypto.randomUUID(),
                        startTime: s.startTime,
                        endTime: s.endTime
                    }));
                }
            } catch (e) {
                console.error("Failed to parse slots param", e);
            }
        }
        return [];
    });

    // Intent: Track success state to prevent UI reset during navigation delay
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || slots.length === 0) {
            return;
        }

        setLoading(true);
        let eventSlug = "";
        let creationSucceeded = false;

        try {
            // Step 1: Create Event Resource
            const res = await fetch("/api/event", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    description,
                    // Note: telegramLink & managerTelegram removed from create flow simplify initial onboarding.
                    // They can be added later in the Manager Dashboard.
                    minPlayers,
                    maxPlayers,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    slots,
                    fromUrl: searchParams.get("fromUrl"),
                    fromUrlId: searchParams.get("fromUrlId")
                }),
            });

            if (!res.ok) {
                throw new Error("Failed to create event");
            }

            const data = await res.json();
            eventSlug = data.slug;

            // Step 2: Establish Administration Rights
            // We use a Server Action to set the cookie because we are in a Client Component
            // and want to ensure it's set as HTTP-Only/Secure on the domain.
            const { setAdminCookie } = await import("@/features/auth/server/actions");
            if (data.adminToken) {
                await setAdminCookie(data.slug, data.adminToken);
            }

            // Mark as successful to lock the UI
            creationSucceeded = true;
            setSuccess(true);

            // Step 3: Redirect to Dashboard
            router.push(`/e/${data.slug}/manage`);
        } catch (error) {
            if (creationSucceeded) {
                // Intent: If creation succeeded but router.push failed (e.g. network timeout),
                // fallback to hard navigation to ensure user gets to the next page.
                console.warn("Router push failed, falling back to location.href", error);
                window.location.href = `/e/${eventSlug}/manage`;
            } else {
                console.error("Submit Failed", error);
                setLoading(false);
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                    Create New Event
                </h1>

                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                            <label className="font-semibold text-slate-200">Event Title</label>
                            <input
                                data-testid="event-title-input"
                                type="text"
                                required
                                placeholder="e.g. Campaign Session 42"
                                className="px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600 text-base"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="font-semibold text-slate-200">Description (Optional)</label>
                            <textarea
                                data-testid="event-description-input"
                                placeholder="What are we playing? Any prep needed?"
                                className="px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[100px] placeholder:text-slate-600 text-base"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="font-semibold text-slate-200">Minimum Players</label>
                                <p className="text-xs text-slate-400">Lowest number of players required for this event</p>
                                <input
                                    data-testid="min-players-input"
                                    type="number"
                                    min="2"
                                    max="100"
                                    className="px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-full text-base"
                                    value={minPlayers}
                                    onChange={(e) => setMinPlayers(parseInt(e.target.value))}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="font-semibold text-slate-200">Maximum Players (Optional)</label>
                                <p className="text-xs text-slate-400">Limit the event size (e.g. for a 5-player one-shot)</p>
                                <input
                                    data-testid="max-players-input"
                                    type="number"
                                    min={minPlayers}
                                    max="100"
                                    placeholder="Unimited"
                                    className="px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-full placeholder:text-slate-600 text-base"
                                    value={maxPlayers || ""}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        setMaxPlayers(isNaN(val) ? null : val);
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <label className="font-semibold text-slate-200">Propose Time Slots</label>
                            <span className="text-sm text-slate-400">{slots.length} slots added</span>
                        </div>
                        <TimeSlotPicker value={slots} onChange={setSlots} />
                    </div>

                    <div className="pt-6 border-t border-slate-800">
                        <button
                            data-testid="create-event-button"
                            type="submit"
                            disabled={loading || slots.length === 0 || success}
                            className="w-full py-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : success ? "Redirecting..." : "Create Event & Get Link"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

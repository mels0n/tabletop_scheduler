"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { TimeSlotPicker, TimeSlot } from "@/components/TimeSlotPicker";
import { Loader2, Info } from "lucide-react";
import { setAdminCookie } from "@/features/auth/server/actions";

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
        <Suspense fallback={<Loader2 className="animate-spin text-parchment" />}>
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

    const [eventType, setEventType] = useState<"ONE_SHOT" | "CAMPAIGN">("ONE_SHOT");
    const [minSessions, setMinSessions] = useState(4);

    // Tooltip visibility state
    const [showOneShotTooltip, setShowOneShotTooltip] = useState(false);
    const [showCampaignTooltip, setShowCampaignTooltip] = useState(false);
    const [showMinSessionsTooltip, setShowMinSessionsTooltip] = useState(false);

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
                    eventType,
                    ...(eventType === "CAMPAIGN" ? { minSessions } : {}),
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
                console.error("Router push failed, falling back to location.href", error);
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate hard navigation when router.push failed
                window.location.href = `/e/${eventSlug}/manage`;
            } else {
                console.error("Event creation failed", error);
                setLoading(false);
            }
        }
    };

    return (
        <div className="min-h-screen bg-ink text-parchment p-6 md:p-12">
            <div className="max-w-3xl mx-auto">
                <h1 className="text-3xl font-bold mb-8 font-display text-parchment">
                    Create New Event
                </h1>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Event Type Selector */}
                    <div className="space-y-3">
                        <label className="font-semibold text-parchment">Event Type</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* One-Shot Card */}
                            <button
                                type="button"
                                aria-pressed={eventType === "ONE_SHOT"}
                                onClick={() => setEventType("ONE_SHOT")}
                                className={`text-left p-4 rounded-card border transition-colors ${
                                    eventType === "ONE_SHOT"
                                        ? "border-gold bg-surface-2 ring-1 ring-gold"
                                        : "bg-surface border-line-strong hover:bg-surface-2"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className={`font-semibold text-sm ${eventType === "ONE_SHOT" ? "text-gold-bright" : "text-parchment"}`}>
                                            One-Shot Session
                                        </p>
                                        <p className="text-xs text-mist mt-1">
                                            A single session scheduled from your candidate dates
                                        </p>
                                    </div>
                                    <div className="relative flex-shrink-0 mt-0.5">
                                        <Info
                                            size={15}
                                            className="text-mist hover:text-parchment cursor-pointer transition-colors"
                                            onMouseEnter={() => setShowOneShotTooltip(true)}
                                            onMouseLeave={() => setShowOneShotTooltip(false)}
                                        />
                                        {showOneShotTooltip && (
                                            <div className="absolute right-0 top-6 z-10 w-56 rounded-control border border-line-strong bg-surface-2 px-3 py-2 text-xs text-parchment-2 shadow-modal">
                                                Best for one-time events, conventions, or trying a new game with a group
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </button>

                            {/* Campaign Card */}
                            <button
                                type="button"
                                aria-pressed={eventType === "CAMPAIGN"}
                                onClick={() => setEventType("CAMPAIGN")}
                                className={`text-left p-4 rounded-card border transition-colors ${
                                    eventType === "CAMPAIGN"
                                        ? "border-gold bg-surface-2 ring-1 ring-gold"
                                        : "bg-surface border-line-strong hover:bg-surface-2"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className={`font-semibold text-sm ${eventType === "CAMPAIGN" ? "text-gold-bright" : "text-parchment"}`}>
                                            Campaign / Series
                                        </p>
                                        <p className="text-xs text-mist mt-1">
                                            Schedule multiple sessions for an ongoing campaign or game night series
                                        </p>
                                    </div>
                                    <div className="relative flex-shrink-0 mt-0.5">
                                        <Info
                                            size={15}
                                            className="text-mist hover:text-parchment cursor-pointer transition-colors"
                                            onMouseEnter={() => setShowCampaignTooltip(true)}
                                            onMouseLeave={() => setShowCampaignTooltip(false)}
                                        />
                                        {showCampaignTooltip && (
                                            <div className="absolute right-0 top-6 z-10 w-64 rounded-control border border-line-strong bg-surface-2 px-3 py-2 text-xs text-parchment-2 shadow-modal">
                                                Best for D&amp;D campaigns, ongoing board game series, or recurring game nights where you need to lock in multiple sessions
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </button>
                        </div>

                        {/* Minimum Sessions: shown only for Campaign */}
                        {eventType === "CAMPAIGN" && (
                            <div className="flex flex-col gap-2 pt-1">
                                <div className="flex items-center gap-2">
                                    <label className="font-semibold text-parchment text-sm">Minimum Sessions</label>
                                    <div className="relative">
                                        <Info
                                            size={14}
                                            className="text-mist hover:text-parchment cursor-pointer transition-colors"
                                            onMouseEnter={() => setShowMinSessionsTooltip(true)}
                                            onMouseLeave={() => setShowMinSessionsTooltip(false)}
                                        />
                                        {showMinSessionsTooltip && (
                                            <div className="absolute left-0 top-5 z-10 w-72 rounded-control border border-line-strong bg-surface-2 px-3 py-2 text-xs text-parchment-2 shadow-modal">
                                                You&apos;ll see a warning during finalization if you haven&apos;t selected enough dates. This is only a guide, so it won&apos;t block you.
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs text-mist">
                                    The minimum number of sessions you&apos;re trying to schedule for this campaign
                                </p>
                                <input
                                    type="number"
                                    min="1"
                                    max="52"
                                    className="field px-4 py-3 w-full md:w-40 text-base"
                                    value={minSessions}
                                    onChange={(e) => setMinSessions(parseInt(e.target.value) || 1)}
                                />
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                            <label className="font-semibold text-parchment">Event Title</label>
                            <input
                                data-testid="event-title-input"
                                type="text"
                                required
                                placeholder="e.g. Campaign Session 42"
                                className="field px-4 py-3 text-base"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="font-semibold text-parchment">Description (Optional)</label>
                            <textarea
                                data-testid="event-description-input"
                                placeholder="What are we playing? Any prep needed?"
                                className="field px-4 py-3 min-h-[100px] text-base"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="font-semibold text-parchment">Minimum Players</label>
                                <p className="text-xs text-mist">Lowest number of players required for this event</p>
                                <input
                                    data-testid="min-players-input"
                                    type="number"
                                    min="2"
                                    max="100"
                                    className="field px-4 py-3 w-full text-base"
                                    value={minPlayers}
                                    onChange={(e) => setMinPlayers(parseInt(e.target.value))}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="font-semibold text-parchment">Maximum Players (Optional)</label>
                                <p className="text-xs text-mist">Limit the event size (e.g. for a 5-player one-shot)</p>
                                <input
                                    data-testid="max-players-input"
                                    type="number"
                                    min={minPlayers}
                                    max="100"
                                    placeholder="Unimited"
                                    className="field px-4 py-3 w-full text-base"
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
                        <TimeSlotPicker value={slots} onChange={setSlots} />
                        {eventType === "CAMPAIGN" && (
                            <p className="text-xs text-mist mt-1">
                                Add all candidate dates, and players will vote on each one
                            </p>
                        )}
                    </div>

                    <div className="pt-6 border-t border-line">
                        <button
                            data-testid="create-event-button"
                            type="submit"
                            disabled={loading || slots.length === 0 || success}
                            className="btn-primary w-full py-4 font-bold text-lg"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : success ? "Redirecting..." : "Create Event & Get Link"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

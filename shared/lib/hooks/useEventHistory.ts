"use client";

import { useEffect, useState, useCallback } from "react";

export interface VisitedEvent {
    slug: string;
    title: string;
    lastVisited: number;
    status?: string;
    scheduledDate?: string;
    eventId?: number;
}

/**
 * Hook to manage the user's local history of visited events.
 * Persists data to localStorage so users can easily return to recent polls.
 */
export function useEventHistory() {
    const [history, setHistory] = useState<VisitedEvent[]>([]);

    useEffect(() => {
        // Prevent access during Server-Side Rendering (SSR)
        if (typeof window === 'undefined') return;

        try {
            const stored = localStorage.getItem('tabletop_history');
            if (stored) {
                setHistory(JSON.parse(stored));
            }
        } catch (e) {
            console.error(e);
        }
    }, []);

    const addToHistory = useCallback((slug: string, title: string) => {
        try {
            const current = JSON.parse(localStorage.getItem('tabletop_history') || "[]");
            // Remove existing if present to bump to top
            const filtered = current.filter((e: VisitedEvent) => e.slug !== slug);
            const newItem = { slug, title, lastVisited: Date.now() };
            const updated = [newItem, ...filtered].slice(0, 20); // Keep last 20

            localStorage.setItem('tabletop_history', JSON.stringify(updated));
            setHistory(updated);
        } catch (e) {
            console.error(e);
        }
    }, []);

    const bulkMerge = useCallback((events: { slug: string, title: string, lastVisited?: number, status?: string, scheduledDate?: string, eventId?: number }[]) => {
        try {
            const current = JSON.parse(localStorage.getItem('tabletop_history') || "[]") as VisitedEvent[];
            const currentMap = new Map(current.map(e => [e.slug, e]));

            let changed = false;

            events.forEach(e => {
                if (!currentMap.has(e.slug)) {
                    currentMap.set(e.slug, {
                        slug: e.slug,
                        title: e.title,
                        lastVisited: e.lastVisited || Date.now(),
                        status: e.status,
                        scheduledDate: e.scheduledDate,
                        eventId: e.eventId
                    });
                    changed = true;
                } else {
                    // Update if server info is fresher/available
                    const existing = currentMap.get(e.slug)!;
                    if (e.status && e.status !== existing.status) {
                        existing.status = e.status;
                        changed = true;
                    }
                    if (e.scheduledDate && e.scheduledDate !== existing.scheduledDate) {
                        existing.scheduledDate = e.scheduledDate;
                        changed = true;
                    }
                    if (e.eventId && e.eventId !== existing.eventId) {
                        existing.eventId = e.eventId;
                        changed = true;
                    }
                }
            });

            if (changed) {
                // Convert back to array and sort by lastVisited
                const updated = Array.from(currentMap.values())
                    .sort((a, b) => b.lastVisited - a.lastVisited)
                    .slice(0, 50); // Increased limit for synced events

                localStorage.setItem('tabletop_history', JSON.stringify(updated));
                setHistory(updated);
            }
        } catch (e) {
            console.error("Failed to bulk merge", e);
        }
    }, []);

    const validateHistory = useCallback(async () => {
        try {
            const current = JSON.parse(localStorage.getItem('tabletop_history') || "[]");
            if (current.length === 0) return;

            const slugs = current.map((e: VisitedEvent) => e.slug);
            const res = await fetch('/api/events/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slugs })
            });

            if (res.ok) {
                const { validSlugs, events } = await res.json() as {
                    validSlugs: string[];
                    events?: { slug: string; id?: number; status?: string; scheduledDate?: string }[];
                };

                // 1. Prune events that no longer exist in the DB.
                const validHistory = current.filter((e: VisitedEvent) => validSlugs.includes(e.slug));

                // 2. Refresh status/scheduledDate/eventId from the server so the profile
                //    reflects true finalized/cancelled state even for un-synced users (whose
                //    local history only ever carried slug/title/lastVisited), and so a
                //    numeric eventId is available to resolve a locally-stored participantId.
                let detailsChanged = false;
                if (events && events.length > 0) {
                    const detailMap = new Map(events.map(e => [e.slug, e]));
                    validHistory.forEach((e: VisitedEvent) => {
                        const server = detailMap.get(e.slug);
                        if (!server) return;
                        if (server.status !== e.status) {
                            e.status = server.status;
                            detailsChanged = true;
                        }
                        if (server.scheduledDate !== e.scheduledDate) {
                            e.scheduledDate = server.scheduledDate;
                            detailsChanged = true;
                        }
                        if (server.id && server.id !== e.eventId) {
                            e.eventId = server.id;
                            detailsChanged = true;
                        }
                    });
                }

                // Only persist if something actually changed.
                if (validHistory.length !== current.length || detailsChanged) {
                    localStorage.setItem('tabletop_history', JSON.stringify(validHistory));
                    setHistory(validHistory);
                }
            }
        } catch (e) {
            console.error("Failed to validate history", e);
        }
    }, []);

    return { history, addToHistory, bulkMerge, validateHistory };
}

"use client";

import { useEventHistory } from "@/hooks/useEventHistory";
import { useEffect } from "react";

/**
 * @component HistoryTracker
 * @description Invisible utility component that tracks visited events.
 * It leverages the 'useEventHistory' hook to persist the event slug and title
 * to the browser's localStorage, allowing for a "Recently Viewed" history feature.
 *
 * @param {Object} props - Component props.
 * @param {string} props.slug - The unique slug of the event.
 * @param {string} props.title - The title of the event.
 * @returns {null} - Returns nothing; side-effect only.
 */
export function HistoryTracker({ slug, title }: { slug: string, title: string }) {
    const { addToHistory } = useEventHistory();

    // Intent: Trigger history update purely as a side effect when the component mounts or props change.
    useEffect(() => {
        addToHistory(slug, title);
    }, [slug, title, addToHistory]);

    return null;
}

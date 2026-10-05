"use client";

import { Info } from "lucide-react";

/**
 * @component DataTooltip
 * @description An interactive tooltip that reveals specific data points stored by the application.
 * Triggered on hover over the word "data".
 */
export function DataTooltip() {
    return (
        <span className="group relative inline-block cursor-help border-b border-dotted border-mist hover:border-gold-bright focus:border-gold-bright transition-colors" tabIndex={0}>
            <span className="text-gold-bright font-medium flex items-center gap-0.5">
                data
                <Info className="w-3 h-3 text-mist group-hover:text-gold-bright group-focus:text-gold-bright" />
            </span>

            {/* Tooltip Content */}
            <span className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-surface border border-line-strong rounded-card text-xs text-parchment-2 shadow-modal transition-all z-50 pointer-events-none">
                <span className="block font-semibold text-gold-bright mb-1">Stored Fields:</span>
                <ul className="list-disc list-inside space-y-0.5">
                    <li>Event Title & Description</li>
                    <li>Proposed Dates</li>
                    <li>Participant Names</li>
                    <li>Availability Votes</li>
                </ul>
                <span className="block mt-2 text-mist italic">Auto-deleted one day after the event ends (drafts one day after their last proposed time, cancelled events one day after cancellation).</span>
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-surface border-b border-r border-line-strong rotate-45"></span>
            </span>
        </span>
    );
}

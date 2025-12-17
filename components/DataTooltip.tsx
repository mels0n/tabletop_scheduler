"use client";

import { Info } from "lucide-react";

/**
 * @component DataTooltip
 * @description An interactive tooltip that reveals specific data points stored by the application.
 * Triggered on hover over the word "data".
 */
export function DataTooltip() {
    return (
        <span className="group relative inline-block cursor-help border-b border-dotted border-slate-500 hover:border-indigo-400 focus:border-indigo-400 transition-colors" tabIndex={0}>
            <span className="text-indigo-300 font-medium flex items-center gap-0.5">
                data
                <Info className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 group-focus:text-indigo-400" />
            </span>

            {/* Tooltip Content */}
            <span className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 shadow-xl transition-all z-50 pointer-events-none">
                <span className="block font-semibold text-indigo-400 mb-1">Stored Fields:</span>
                <ul className="list-disc list-inside space-y-0.5">
                    <li>Event Title & Description</li>
                    <li>Proposed Dates</li>
                    <li>Participant Names</li>
                    <li>Availability Votes</li>
                </ul>
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-slate-900 border-b border-r border-slate-700 rotate-45"></span>
            </span>
        </span>
    );
}

"use client";

import React from "react";

interface DateTimeRangeInputsProps {
    date: string;
    setDate: (d: string) => void;
    start: string;
    setStart: (s: string) => void;
    end: string;
    setEnd: (e: string) => void;
}

export function DateTimeRangeInputs({ date, setDate, start, setStart, end, setEnd }: DateTimeRangeInputsProps) {
    return (
        <>
            <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                <label className="text-xs text-slate-400">Date</label>
                <input
                    type="date"
                    data-testid="slot-date-input"
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
                <label className="text-xs text-slate-400">Start</label>
                <input
                    type="time"
                    data-testid="slot-start-input"
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
                <label className="text-xs text-slate-400">End</label>
                <input
                    type="time"
                    data-testid="slot-end-input"
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                />
            </div>
        </>
    );
}

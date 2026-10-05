"use client";

import React, { useId } from "react";

interface DateTimeRangeInputsProps {
    date: string;
    setDate: (d: string) => void;
    start: string;
    setStart: (s: string) => void;
    end: string;
    setEnd: (e: string) => void;
}

export function DateTimeRangeInputs({ date, setDate, start, setStart, end, setEnd }: DateTimeRangeInputsProps) {
    const fieldId = useId();
    return (
        <>
            <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                <label htmlFor={`${fieldId}-date`} className="text-xs text-mist">Date</label>
                <input
                    id={`${fieldId}-date`}
                    type="date"
                    data-testid="slot-date-input"
                    className="field w-full"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
                <label htmlFor={`${fieldId}-start`} className="text-xs text-mist">Start</label>
                <input
                    id={`${fieldId}-start`}
                    type="time"
                    data-testid="slot-start-input"
                    className="field w-full"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
                <label htmlFor={`${fieldId}-end`} className="text-xs text-mist">End</label>
                <input
                    id={`${fieldId}-end`}
                    type="time"
                    data-testid="slot-end-input"
                    className="field w-full"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                />
            </div>
        </>
    );
}

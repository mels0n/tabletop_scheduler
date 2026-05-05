"use client";

import React, { useRef, useState, useEffect } from "react";
import {
    format, startOfMonth, endOfMonth, eachDayOfInterval,
    getDay, addMonths, subMonths, isBefore, startOfDay, isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MultiDayCalendarProps {
    selectedDates: string[]; // YYYY-MM-DD strings
    onDatesChange: (dates: string[]) => void;
}

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function MultiDayCalendar({ selectedDates, onDatesChange }: MultiDayCalendarProps) {
    const [viewDate, setViewDate] = useState(() => startOfMonth(new Date()));
    const isPaintingRef = useRef(false);
    // Keep a ref in sync so pointer-move handlers never close over stale state
    const selectedDatesRef = useRef(selectedDates);
    selectedDatesRef.current = selectedDates;

    const today = startOfDay(new Date());
    const days = eachDayOfInterval({ start: startOfMonth(viewDate), end: endOfMonth(viewDate) });
    const firstDayOfWeek = getDay(days[0]);
    const selectedSet = new Set(selectedDates);

    useEffect(() => {
        const stop = () => { isPaintingRef.current = false; };
        window.addEventListener("pointerup", stop);
        return () => window.removeEventListener("pointerup", stop);
    }, []);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, dateStr: string) => {
        e.preventDefault(); // prevents scroll hijack on mobile during drag
        isPaintingRef.current = true;
        const current = new Set(selectedDatesRef.current);
        if (current.has(dateStr)) {
            current.delete(dateStr);
        } else {
            current.add(dateStr);
        }
        onDatesChange(Array.from(current).sort());
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isPaintingRef.current) return;
        e.preventDefault();
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
        const dateStr = el?.closest("[data-date]")?.getAttribute("data-date");
        if (!dateStr) return;
        const current = new Set(selectedDatesRef.current);
        if (!current.has(dateStr)) {
            current.add(dateStr);
            onDatesChange(Array.from(current).sort());
        }
    };

    return (
        <div className="select-none w-full">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-2">
                <button
                    type="button"
                    onClick={() => setViewDate((d) => subMonths(d, 1))}
                    className="p-2 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label="Previous month"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold text-slate-200">
                    {format(viewDate, "MMMM yyyy")}
                </span>
                <button
                    type="button"
                    onClick={() => setViewDate((d) => addMonths(d, 1))}
                    className="p-2 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label="Next month"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Day-of-week header */}
            <div className="grid grid-cols-7 mb-1">
                {DAY_LABELS.map((d) => (
                    <div key={d} className="text-center text-xs text-slate-500 font-medium py-1">
                        {d}
                    </div>
                ))}
            </div>

            {/* Day grid — pointer-move fires here so drag stays smooth */}
            <div className="grid grid-cols-7 gap-0.5" onPointerMove={handlePointerMove}>
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} />
                ))}

                {days.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const isPast = isBefore(day, today);
                    const isSelected = selectedSet.has(dateStr);
                    const isTodayDate = isToday(day);

                    return (
                        <div
                            key={dateStr}
                            data-date={isPast ? undefined : dateStr}
                            onPointerDown={isPast ? undefined : (e) => handlePointerDown(e, dateStr)}
                            className={[
                                "aspect-square flex items-center justify-center rounded-md text-sm transition-colors",
                                isPast
                                    ? "text-slate-700 cursor-not-allowed"
                                    : "cursor-pointer",
                                isSelected
                                    ? "bg-indigo-600 text-white"
                                    : isPast
                                        ? ""
                                        : isTodayDate
                                            ? "border border-indigo-500/50 text-indigo-300 hover:bg-slate-700"
                                            : "text-slate-300 hover:bg-slate-700",
                            ].join(" ")}
                        >
                            {format(day, "d")}
                        </div>
                    );
                })}
            </div>

            {/* Selection status / clear */}
            <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">Tap or drag to select days</span>
                {selectedDates.length > 0 && (
                    <button
                        type="button"
                        onClick={() => onDatesChange([])}
                        className="text-slate-400 hover:text-red-400 transition-colors"
                    >
                        Clear ({selectedDates.length} selected)
                    </button>
                )}
            </div>
        </div>
    );
}

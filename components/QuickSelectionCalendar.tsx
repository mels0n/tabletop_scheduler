"use client";

import React, { useRef, useState, useEffect } from "react";
import {
    format, startOfMonth, endOfMonth, eachDayOfInterval,
    getDay, addMonths, subMonths, isBefore, isAfter,
} from "date-fns";
import { ChevronLeft, ChevronRight, Check, HelpCircle, X, Info, Loader2, Home } from "lucide-react";
import { clsx } from "clsx";

interface Slot {
    id: number;
    startTime: Date;
    endTime: Date;
    counts: { yes: number; maybe: number; no: number };
    votes: any[];
}

type Preference = "YES" | "MAYBE" | "NO";

interface QuickSelectionCalendarProps {
    slots: Slot[];
    votes: Record<number, string | undefined>;
    onVotesChange: (votes: Record<number, string | undefined>) => void;
    onSave: (completeVotes: Record<number, string | undefined>) => void;
    isSubmitting: boolean;
    userName: string;
    canHost: Record<number, boolean>;
    onCanHostChange: (h: Record<number, boolean>) => void;
}

const BRUSH_CONFIG: { pref: Preference; label: string; sub: string; icon: React.ReactNode; active: string; inactive: string }[] = [
    {
        pref: "YES",
        label: "Available",
        sub: "Perfect for me",
        icon: <Check className="w-3.5 h-3.5" />,
        active: "bg-green-600 text-white ring-2 ring-green-400 ring-offset-1 ring-offset-slate-900",
        inactive: "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200",
    },
    {
        pref: "MAYBE",
        label: "If Needed",
        sub: "Not a preference",
        icon: <HelpCircle className="w-3.5 h-3.5" />,
        active: "bg-yellow-600 text-white ring-2 ring-yellow-400 ring-offset-1 ring-offset-slate-900",
        inactive: "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200",
    },
    {
        pref: "NO",
        label: "No",
        sub: "Can't make it",
        icon: <X className="w-3.5 h-3.5" />,
        active: "bg-red-700 text-white ring-2 ring-red-400 ring-offset-1 ring-offset-slate-900",
        inactive: "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200",
    },
];

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function slotColor(pref: string | undefined) {
    if (pref === "YES") return "bg-green-600 text-green-50";
    if (pref === "MAYBE") return "bg-yellow-600 text-yellow-50";
    if (pref === "NO") return "bg-red-900/70 text-red-400";
    return "bg-slate-700/60 text-slate-500"; // unpainted → will be NO on save
}

export function QuickSelectionCalendar({
    slots,
    votes,
    onVotesChange,
    onSave,
    isSubmitting,
    userName,
    canHost,
    onCanHostChange,
}: QuickSelectionCalendarProps) {
    const [brush, setBrush] = useState<Preference>("YES");
    const [hostBrush, setHostBrush] = useState(false);
    const [viewDate, setViewDate] = useState(() => {
        if (slots.length > 0) return startOfMonth(new Date(slots[0].startTime));
        return startOfMonth(new Date());
    });

    const isPaintingRef = useRef(false);
    // Refs so pointer-move handlers never close over stale state
    const votesRef = useRef(votes);
    votesRef.current = votes;
    const brushRef = useRef(brush);
    brushRef.current = brush;
    const hostBrushRef = useRef(hostBrush);
    hostBrushRef.current = hostBrush;
    const canHostRef = useRef(canHost);
    canHostRef.current = canHost;

    // Group slots by calendar date, sorted earliest-first within each day
    const slotsByDay = new Map<string, Slot[]>();
    slots.forEach((slot) => {
        const dateStr = format(new Date(slot.startTime), "yyyy-MM-dd");
        if (!slotsByDay.has(dateStr)) slotsByDay.set(dateStr, []);
        slotsByDay.get(dateStr)!.push(slot);
    });
    slotsByDay.forEach((daySlots) =>
        daySlots.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    );

    const viewStart = startOfMonth(viewDate);
    const viewEnd = endOfMonth(viewDate);

    const prevMonth = subMonths(viewDate, 1);
    const nextMonth = addMonths(viewDate, 1);
    const prevMonthStart = startOfMonth(prevMonth);
    const prevMonthEnd = endOfMonth(prevMonth);
    const nextMonthStart = startOfMonth(nextMonth);
    const nextMonthEnd = endOfMonth(nextMonth);

    // Count slots that exist before / after the current view month
    const slotsBeforeCount = slots.filter((s) => isBefore(new Date(s.startTime), viewStart)).length;
    const slotsAfterCount = slots.filter((s) => isAfter(new Date(s.startTime), viewEnd)).length;
    // Count specifically in the immediately adjacent months for the label
    const prevMonthCount = slots.filter((s) => {
        const d = new Date(s.startTime);
        return !isBefore(d, prevMonthStart) && !isAfter(d, prevMonthEnd);
    }).length;
    const nextMonthCount = slots.filter((s) => {
        const d = new Date(s.startTime);
        return !isBefore(d, nextMonthStart) && !isAfter(d, nextMonthEnd);
    }).length;

    const days = eachDayOfInterval({ start: viewStart, end: viewEnd });
    const firstDayOfWeek = getDay(days[0]);

    useEffect(() => {
        const stop = () => { isPaintingRef.current = false; };
        window.addEventListener("pointerup", stop);
        return () => window.removeEventListener("pointerup", stop);
    }, []);

    const applyBrush = (slotId: number) => {
        const next = { ...votesRef.current, [slotId]: brushRef.current };
        onVotesChange(next);

        const nextHost = { ...canHostRef.current };
        if (brushRef.current === "NO" || !hostBrushRef.current) {
            delete nextHost[slotId];
        } else {
            nextHost[slotId] = true;
        }
        onCanHostChange(nextHost);
    };

    const handleSlotPointerDown = (e: React.PointerEvent, slotId: number) => {
        e.preventDefault();
        isPaintingRef.current = true;
        if (votesRef.current[slotId] === brushRef.current) {
            // Tapping the same preference deselects; dragging always paints
            const next = { ...votesRef.current, [slotId]: undefined };
            onVotesChange(next);
            const nextHost = { ...canHostRef.current };
            delete nextHost[slotId];
            onCanHostChange(nextHost);
        } else {
            applyBrush(slotId);
        }
    };

    const handleGridPointerMove = (e: React.PointerEvent) => {
        if (!isPaintingRef.current) return;
        e.preventDefault();
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
        const raw = el?.closest("[data-slot-id]")?.getAttribute("data-slot-id");
        if (raw) applyBrush(parseInt(raw));
    };

    const yesCount = Object.values(votes).filter((v) => v === "YES").length;
    const maybeCount = Object.values(votes).filter((v) => v === "MAYBE").length;
    const totalPainted = yesCount + maybeCount;

    const handleSave = () => {
        const completeVotes = { ...votes };
        slots.forEach((slot) => {
            if (completeVotes[slot.id] === undefined) completeVotes[slot.id] = "NO";
        });
        onVotesChange(completeVotes);
        onSave(completeVotes);
    };

    const saveLabel = (() => {
        if (!userName) return "Enter your name first";
        if (totalPainted === 0) return "Paint your availability above";
        const parts: string[] = [];
        if (yesCount > 0) parts.push(`${yesCount} Available`);
        if (maybeCount > 0) parts.push(`${maybeCount} If Needed`);
        return `Save Selections — ${parts.join(" · ")}`;
    })();

    return (
        <div className="space-y-4">
            {/* Brush selector */}
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 space-y-2">
                <div className="flex items-center gap-1 text-xs text-slate-400">
                    <span className="font-medium">Painting mode — tap or drag days to mark:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {BRUSH_CONFIG.map(({ pref, label, sub, icon, active, inactive }) => (
                        <button
                            key={pref}
                            type="button"
                            onClick={() => {
                                setBrush(pref);
                                if (pref === "NO") setHostBrush(false);
                            }}
                            className={clsx(
                                "flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all min-h-[44px]",
                                brush === pref ? active : inactive
                            )}
                        >
                            {icon}
                            <span>{label}</span>
                            <span className={clsx("font-normal hidden sm:inline", brush === pref ? "opacity-70" : "text-slate-500")}>
                                — {sub}
                            </span>
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-3 pt-1 border-t border-slate-800/50">
                    <button
                        type="button"
                        disabled={brush === "NO"}
                        onClick={() => setHostBrush(h => !h)}
                        className={clsx(
                            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all min-h-[36px]",
                            hostBrush && brush !== "NO"
                                ? "bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-900"
                                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200",
                            brush === "NO" && "opacity-40 cursor-not-allowed"
                        )}
                    >
                        <Home className="w-3.5 h-3.5" />
                        <span>Can Host</span>
                    </button>
                    <span className="text-xs text-slate-500">
                        {hostBrush && brush !== "NO"
                            ? "Painted slots will include hosting"
                            : "Enable to mark you can host as you paint"}
                    </span>
                </div>
            </div>

            {/* Default-to-No info */}
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-950/30 border border-amber-800/30 rounded-lg text-xs text-amber-300/80">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                    Slots you don&apos;t paint will be saved as <strong>No</strong> when you submit.
                    Days without any session are greyed out.
                </span>
            </div>

            {/* Calendar */}
            <div className="select-none">
                {/* Month nav */}
                <div className="flex items-center justify-between gap-2 mb-2">
                    {/* Prev month button */}
                    <button
                        type="button"
                        onClick={() => setViewDate((d) => subMonths(d, 1))}
                        aria-label="Previous month"
                        className={clsx(
                            "flex items-center gap-1.5 px-3 py-2.5 rounded-lg transition-colors min-w-0 shrink min-h-[44px]",
                            slotsBeforeCount > 0
                                ? "bg-indigo-600/20 border border-indigo-500/50 text-indigo-300 hover:bg-indigo-600/30"
                                : "text-slate-600 hover:text-slate-400 hover:bg-slate-800"
                        )}
                    >
                        <ChevronLeft className="w-4 h-4 shrink-0" />
                        {slotsBeforeCount > 0 && (
                            <span className="text-xs font-medium truncate">
                                {prevMonthCount > 0
                                    ? `${format(prevMonth, "MMM")} (${prevMonthCount})`
                                    : `${slotsBeforeCount} earlier`}
                            </span>
                        )}
                    </button>

                    <span className="text-sm font-semibold text-slate-200 shrink-0">
                        {format(viewDate, "MMMM yyyy")}
                    </span>

                    {/* Next month button */}
                    <button
                        type="button"
                        onClick={() => setViewDate((d) => addMonths(d, 1))}
                        aria-label="Next month"
                        className={clsx(
                            "flex items-center gap-1.5 px-3 py-2.5 rounded-lg transition-colors min-w-0 shrink min-h-[44px]",
                            slotsAfterCount > 0
                                ? "bg-indigo-600/20 border border-indigo-500/50 text-indigo-300 hover:bg-indigo-600/30"
                                : "text-slate-600 hover:text-slate-400 hover:bg-slate-800"
                        )}
                    >
                        {slotsAfterCount > 0 && (
                            <span className="text-xs font-medium truncate">
                                {nextMonthCount > 0
                                    ? `${format(nextMonth, "MMM")} (${nextMonthCount})`
                                    : `${slotsAfterCount} later`}
                            </span>
                        )}
                        <ChevronRight className="w-4 h-4 shrink-0" />
                    </button>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 mb-1">
                    {DAY_LABELS.map((d) => (
                        <div key={d} className="text-center text-[10px] text-slate-500 font-medium py-1">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Day grid — touch-action:none prevents scroll from fighting drag painting */}
                <div
                    className="grid grid-cols-7 gap-0.5"
                    style={{ touchAction: "none" }}
                    onPointerMove={handleGridPointerMove}
                >
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                        <div key={`empty-${i}`} />
                    ))}

                    {days.map((day) => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const daySlots = slotsByDay.get(dateStr) || [];
                        const hasSlots = daySlots.length > 0;

                        return (
                            <div
                                key={dateStr}
                                className={clsx(
                                    "flex flex-col rounded-md border overflow-hidden",
                                    "min-h-[72px] sm:min-h-[80px]",
                                    hasSlots ? "border-slate-600" : "border-slate-800/40"
                                )}
                            >
                                {/* Day number */}
                                <span className={clsx(
                                    "text-[10px] leading-none px-1 pt-0.5 shrink-0",
                                    hasSlots ? "text-slate-300" : "text-slate-700"
                                )}>
                                    {format(day, "d")}
                                </span>

                                {/* Slot strips — flex-col fills remaining height */}
                                {hasSlots && (
                                    <div className="flex flex-col flex-1 gap-px px-0.5 pb-0.5 mt-0.5">
                                        {daySlots.map((slot) => (
                                            <div
                                                key={slot.id}
                                                data-slot-id={slot.id}
                                                onPointerDown={(e) => handleSlotPointerDown(e, slot.id)}
                                                suppressHydrationWarning
                                                className={clsx(
                                                    "flex-1 flex items-center justify-center",
                                                    "rounded text-[9px] sm:text-[10px] font-medium cursor-pointer transition-colors",
                                                    "min-h-[24px]",
                                                    slotColor(votes[slot.id])
                                                )}
                                            >
                                                {format(new Date(slot.startTime), "ha").toLowerCase()}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

            </div>

            {/* Save button */}
            <button
                type="button"
                onClick={handleSave}
                disabled={isSubmitting || !userName || totalPainted === 0}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2"
            >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {saveLabel}
            </button>
        </div>
    );
}

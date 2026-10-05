"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, Calendar as CalendarIcon, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ClientTimezone } from "./ClientDate";
import { MultiDayCalendar } from "./MultiDayCalendar";

export interface TimeSlot {
    id: string;
    startTime: string;
    endTime: string;
}

interface TimeSlotPickerProps {
    value: TimeSlot[];
    onChange: (slots: TimeSlot[]) => void;
}

export function TimeSlotPicker({ value, onChange }: TimeSlotPickerProps) {
    const [selectedDates, setSelectedDates] = useState<string[]>([]);
    const [showCalendar, setShowCalendar] = useState(false);
    const [start, setStart] = useState("18:00");
    const [end, setEnd] = useState("22:00");
    const datePickerRef = useRef<HTMLDivElement>(null);

    // Close calendar on outside click or Escape
    useEffect(() => {
        const handleOutside = (e: MouseEvent) => {
            if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
                setShowCalendar(false);
            }
        };
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") setShowCalendar(false);
        };
        document.addEventListener("mousedown", handleOutside);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handleOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, []);

    const dateLabel =
        selectedDates.length === 0
            ? null
            : selectedDates.length === 1
                ? format(new Date(selectedDates[0] + "T00:00:00"), "MMM d, yyyy")
                : `${selectedDates.length} days selected`;

    const addSlot = () => {
        if (selectedDates.length === 0 || !start || !end) return;

        const now = new Date();
        const newSlots: TimeSlot[] = [];
        const skipped: string[] = [];

        for (const date of selectedDates) {
            const startDateTime = new Date(`${date}T${start}:00`);
            let endDateTime = new Date(`${date}T${end}:00`);
            if (endDateTime <= startDateTime) {
                endDateTime = new Date(endDateTime.getTime() + 24 * 60 * 60 * 1000);
            }

            if (startDateTime < now) {
                skipped.push(date);
                continue;
            }

            const isDuplicate = value.some(
                (slot) =>
                    slot.startTime === startDateTime.toISOString() &&
                    slot.endTime === endDateTime.toISOString()
            );
            if (isDuplicate) continue;

            newSlots.push({
                id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36),
                startTime: startDateTime.toISOString(),
                endTime: endDateTime.toISOString(),
            });
        }

        if (newSlots.length > 0) {
            onChange([...value, ...newSlots]);
            setSelectedDates([]);
            setShowCalendar(false);
        }

        if (skipped.length > 0) {
            alert(
                `${skipped.length} date${skipped.length !== 1 ? "s" : ""} skipped because they are in the past.`
            );
        }
    };

    const removeSlot = (id: string) => {
        onChange(value.filter((s) => s.id !== id));
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-parchment">Propose Time Slots</h3>
                    <div className="text-xs text-mist font-medium bg-surface-2 px-2 py-0.5 rounded-control border border-line">
                        Times are in your local timezone <ClientTimezone className="font-mono text-gold-bright" />
                    </div>
                </div>
                <span className="text-sm text-mist">{value.length} slots added</span>
            </div>

            {/* Input Controls: original row layout restored */}
            <div className="flex flex-wrap gap-4 p-4 border border-line rounded-card bg-surface">

                {/* Date field: opens multi-day calendar popover */}
                <div className="flex flex-col gap-1 flex-1 min-w-[160px] relative" ref={datePickerRef}>
                    <label className="text-xs text-mist">Date</label>
                    <button
                        type="button"
                        data-testid="slot-date-input"
                        onClick={() => setShowCalendar((v) => !v)}
                        className="field flex items-center gap-2 px-3 py-3 min-h-[44px] text-left w-full transition-colors hover:bg-surface-2"
                    >
                        <CalendarIcon className="w-4 h-4 text-mist shrink-0" />
                        <span className={dateLabel ? "text-parchment text-sm" : "text-mist text-sm"}>
                            {dateLabel ?? "mm/dd/yyyy"}
                        </span>
                    </button>

                    {showCalendar && (
                        <div className="absolute top-full left-0 z-50 mt-1 p-3 bg-surface border border-line-strong rounded-card shadow-modal w-80">
                            <MultiDayCalendar
                                selectedDates={selectedDates}
                                onDatesChange={setSelectedDates}
                            />
                        </div>
                    )}
                </div>

                {/* Time inputs: unchanged */}
                <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
                    <label className="text-xs text-mist">Start</label>
                    <input
                        type="time"
                        data-testid="slot-start-input"
                        className="field px-3 py-3 min-h-[44px] w-full"
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
                    <label className="text-xs text-mist">End</label>
                    <input
                        type="time"
                        data-testid="slot-end-input"
                        className="field px-3 py-3 min-h-[44px] w-full"
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                    />
                </div>

                <div className="flex items-end">
                    <button
                        data-testid="add-slot-button"
                        type="button"
                        onClick={addSlot}
                        disabled={selectedDates.length === 0}
                        className="btn-primary px-4 py-3 min-h-[44px] font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        {selectedDates.length > 1 ? `Add ${selectedDates.length} Slots` : "Add Slot"}
                    </button>
                </div>
            </div>

            {/* Selected Slots List */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {value.map((slot) => {
                    const startObj = parseISO(slot.startTime);
                    const endObj = parseISO(slot.endTime);
                    return (
                        <div key={slot.id} className="relative group flex items-start gap-3 p-3 rounded-card border border-line bg-surface hover:border-line-strong transition-colors">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 text-gold-bright font-semibold">
                                    <CalendarIcon className="w-4 h-4" />
                                    {format(startObj, "EEE, MMM d")}
                                </div>
                                <div className="flex items-center gap-2 text-parchment-2 mt-1">
                                    <Clock className="w-4 h-4 text-mist" />
                                    {format(startObj, "h:mm a")} - {format(endObj, "h:mm a")}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => removeSlot(slot.id)}
                                aria-label={`Remove time slot starting at ${format(startObj, "h:mm a")}`}
                                className="absolute top-2 right-2 p-1 text-mist hover:text-no opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    );
                })}
                {value.length === 0 && (
                    <div className="col-span-full py-8 text-center text-mist border border-dashed border-line rounded-card">
                        No times slots added. Pick a date and time above.
                    </div>
                )}
            </div>
        </div>
    );
}

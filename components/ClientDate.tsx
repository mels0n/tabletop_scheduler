"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";

/**
 * @interface ClientDateProps
 * @description Props for the ClientDate component.
 * @property {Date | string | number} date - The date value to format.
 * @property {string} formatStr - The date-fns format string (e.g., 'PPP').
 * @property {string} [className] - Optional CSS classes for the container span.
 */
interface ClientDateProps {
    date: Date | string | number;
    formatStr: string;
    className?: string;
}

/**
 * @component ClientDate
 * @description A utility component to render dates on the client side only.
 * @purpose Prevents SSR Hydration Mismatches caused by timezones (Server time vs User time).
 * Instead of mismatched text, the date is rendered only after the component mounts in the browser.
 *
 * @param {ClientDateProps} props - Component props.
 * @returns {JSX.Element | null} The formatted date string wrapped in a span, or null if not mounted.
 */
export function ClientDate({ date, formatStr, className }: ClientDateProps) {
    // Intent: Track mounting status to determine when it's safe to render the localized date.
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Intent: Return nothing during SSR to avoid mismatch errors.
    if (!mounted) {
        return null;
    }

    return (
        <span className={className}>
            {format(new Date(date), formatStr)}
        </span>
    );
}

/**
 * @component ClientTimezone
 * @description Renders the user's local timezone code (e.g. "CST", "GMT", "PST")
 * Safe for hydration (renders nothing on server).
 */
export function ClientTimezone({ className, parenthesized = true }: { className?: string, parenthesized?: boolean }) {
    const [tz, setTz] = useState("");

    useEffect(() => {
        // Intent: Get short timezone name via Intl API
        // Fallback to simpler extraction if needed, but 'short' usually gives EST/CST etc.
        try {
            // The original line `const short name = ...` had a syntax error. Corrected to `const shortName = ...`
            // However, the subsequent `Intl.DateTimeFormat` approach is more robust.
            // const shortName = new Date().toLocaleTimeString('en-us', { timeZoneName: 'short' }).split(' ').pop();
            // Note: split pop is a bit risky for "Standard Time", prefer direct part lookup if possible, 
            // but for major US/EU zones usually works. 
            // Better: Intl.DateTimeFormat with timeZoneName: 'short'

            const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date());
            const tzName = parts.find(p => p.type === 'timeZoneName')?.value;

            if (tzName) {
                setTz(tzName);
            }
        } catch (e) {
            // Fallback
            setTz("");
        }
    }, []);

    if (!tz) return null;

    return (
        <span className={className}>
            {parenthesized ? `(${tz})` : tz}
        </span>
    );
}

"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

/**
 * @component CopyLinkButton
 * @description A reusable button component that copies a given URL to the user's clipboard.
 * It provides visual feedback (check icon) upon successful copy.
 *
 * @param {Object} props - Component props.
 * @param {string} props.url - The URL to copy. Can be relative (appended to origin) or absolute.
 * @returns {JSX.Element} A button with copy functionality.
 */
export function CopyLinkButton({ url }: { url: string }) {
    const [copied, setCopied] = useState(false);

    /**
     * Handles the clipboard write operation.
     * Normalizes relative URLs to absolute URLs using window.location.origin.
     */
    const handleCopy = () => {
        // Intent: Ensure we always copy a full, valid URL.
        const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
        navigator.clipboard.writeText(fullUrl);

        // Intent: Show temporary success state
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs font-medium text-slate-300 transition-colors border border-slate-700"
        >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Link2 className="w-3 h-3" />}
            {copied ? "Copied!" : "Copy Link"}
        </button>
    )
}

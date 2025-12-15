"use client";

import { useEffect } from "react";

/**
 * @component GoogleAdBar
 * @description Renders a Google AdSense display unit directly on the page.
 * Responsively adjusts to screen width using AdSense's 'auto' format.
 * Includes a safety check to remain invisible during development or if unconfigured.
 *
 * @returns {JSX.Element | null} The AdSense `ins` element or null if disabled.
 */
export function GoogleAdBar() {
    // Intent: Initialize AdSense script on mount.
    // The main script tag should be in layout.tsx; this pushes the specific ad unit command.
    useEffect(() => {
        try {
            // @ts-ignore
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            console.error("AdSense Error", e);
        }
    }, []);

    // Intent: Fallback placeholder for valid env var parsing during build/runtime.
    // For production, set NEXT_PUBLIC_GOOGLE_ADSENSE_ID in your deployment platform (e.g., Vercel).
    const adClient = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID || "ca-pub-XXXXXXXXXXXXXXXX";
    const adSlot = "1234567890"; // Note: Consider externalizing this to an env var if multiple slots are used.

    // Intent: Prevent serving empty ad containers or errors in non-production environments.
    // Logic: If the ID matches the placeholder, return null to render nothing.
    if (adClient === "ca-pub-XXXXXXXXXXXXXXXX") {
        return null;
    }

    return (
        <div className="w-full flex justify-center py-4 bg-slate-950 border-t border-slate-900">
            <ins
                className="adsbygoogle"
                style={{ display: "block" }}
                data-ad-client={adClient}
                data-ad-slot={adSlot}
                data-ad-format="auto"
                data-full-width-responsive="true"
            />
        </div>
    );
}

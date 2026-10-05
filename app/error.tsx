"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

/**
 * @component GlobalError
 * @description Next.js App Router global error boundary.
 *
 * Handles uncaught errors in Server and Client Components. The most common
 * cause in this app is a stale auth cookie (tabletop_user_discord_id or
 * tabletop_user_chat_id) whose value no longer matches a valid session,
 * causing downstream DB or Server Action calls to throw.
 *
 * Strategy: Present a friendly message with a one-click "Clear & Reload"
 * action that calls /api/auth/clear-session to wipe auth cookies, then
 * reloads the page cleanly.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log to console for debugging without exposing details to users
        console.error("[GlobalError]", error);
    }, [error]);

    const handleClearAndReload = async () => {
        try {
            await fetch("/api/auth/clear-session", { method: "POST" });
        } catch {
            // Best-effort — even if the API fails, reload anyway
        }
        window.location.reload();
    };

    return (
        <div className="min-h-screen bg-ink text-parchment flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-surface border border-line rounded-card p-8 space-y-6 text-center">
                <TriangleAlert className="w-12 h-12 mx-auto text-maybe" aria-hidden="true" />
                <div className="space-y-2">
                    <h1 className="text-xl font-bold text-parchment">Something went wrong</h1>
                    <p className="text-mist text-sm">
                        This is usually caused by a stale session. Clearing your session
                        and reloading should fix it.
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleClearAndReload}
                        className="btn-primary w-full text-sm"
                    >
                        Clear Session &amp; Reload
                    </button>
                    <button
                        onClick={reset}
                        className="btn-secondary w-full py-2 text-sm font-normal"
                    >
                        Try Again Without Clearing
                    </button>
                </div>

                {process.env.NODE_ENV === "development" && error?.message && (
                    <p className="text-xs text-no font-mono bg-no-bg p-3 rounded-control text-left break-all">
                        {error.message}
                    </p>
                )}
            </div>
        </div>
    );
}

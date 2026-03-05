"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

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
    const router = useRouter();

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
        <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-8 space-y-6 text-center">
                <div className="text-5xl">⚠️</div>
                <div className="space-y-2">
                    <h1 className="text-xl font-bold text-slate-100">Something went wrong</h1>
                    <p className="text-slate-400 text-sm">
                        This is usually caused by a stale session. Clearing your session
                        and reloading should fix it.
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleClearAndReload}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition-colors"
                    >
                        Clear Session &amp; Reload
                    </button>
                    <button
                        onClick={reset}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors"
                    >
                        Try Again Without Clearing
                    </button>
                </div>

                {process.env.NODE_ENV === "development" && error?.message && (
                    <p className="text-xs text-red-400 font-mono bg-red-950/30 p-3 rounded text-left break-all">
                        {error.message}
                    </p>
                )}
            </div>
        </div>
    );
}

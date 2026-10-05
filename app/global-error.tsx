"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Last-resort error boundary. Next renders this in place of the root layout when the
 * layout itself throws, so it must supply its own <html> and <body>. Errors below the
 * layout are handled by app/error.tsx.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Browser console only; the server has already logged the digest.
        console.error("[GlobalError]", error.digest ?? error.message);
    }, [error]);

    return (
        <html lang="en">
            <body className="min-h-screen bg-ink text-parchment flex items-center justify-center p-6">
                <main className="max-w-md w-full bg-surface border border-line rounded-card p-8 space-y-6 text-center">
                    <div className="space-y-2">
                        <h1 className="text-xl font-bold text-parchment">Something went wrong</h1>
                        <p className="text-mist text-sm">
                            The page could not be loaded. Try again, or come back in a minute.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3">
                        <button
                            type="button"
                            onClick={reset}
                            className="btn-primary w-full text-sm"
                        >
                            Try again
                        </button>
                        {/* A plain anchor: the router may be what failed. */}
                        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                        <a
                            href="/"
                            className="btn-secondary w-full py-2 text-sm font-normal"
                        >
                            Go to the home page
                        </a>
                    </div>
                    {error.digest && (
                        <p className="text-xs text-mist">Reference: {error.digest}</p>
                    )}
                </main>
            </body>
        </html>
    );
}

/**
 * @component EventLoading
 * @description Instant loading skeleton for event pages (`/e/[slug]` and its
 * `/manage` subroute).
 *
 * Event pages fetch the full event (slots, participants, sessions) from the
 * database before rendering, which can take seconds on a cold serverless start.
 * This skeleton mirrors the event page layout (title header, voting/slot cards)
 * so the navigation shows visible progress immediately instead of sitting still.
 */
export default function EventLoading() {
    return (
        <main className="min-h-screen bg-slate-950 text-slate-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-8 animate-pulse" role="status" aria-label="Loading event">
                {/* Title + description header */}
                <div className="space-y-4 pt-4">
                    <div className="h-9 w-3/5 bg-slate-800 rounded" />
                    <div className="h-5 w-4/5 bg-slate-800/70 rounded" />
                    <div className="flex gap-3">
                        <div className="h-5 w-32 bg-slate-800/70 rounded-full" />
                        <div className="h-5 w-28 bg-slate-800/70 rounded-full" />
                    </div>
                </div>

                {/* Slot / voting card placeholders */}
                <div className="space-y-4">
                    {[0, 1, 2].map(i => (
                        <div key={i} className="border border-slate-800 rounded-lg p-5 space-y-3">
                            <div className="h-5 w-48 bg-slate-800 rounded" />
                            <div className="h-4 w-64 bg-slate-800/60 rounded" />
                            <div className="h-9 w-full bg-slate-800/40 rounded" />
                        </div>
                    ))}
                </div>

                <span className="sr-only">Loading event</span>
            </div>
        </main>
    );
}

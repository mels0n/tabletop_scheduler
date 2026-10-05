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
        <main className="min-h-screen bg-ink text-parchment p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-8 animate-pulse" role="status" aria-label="Loading event">
                {/* Title + description header */}
                <div className="space-y-4 pt-4">
                    <div className="h-9 w-3/5 bg-surface-2 rounded-control" />
                    <div className="h-5 w-4/5 bg-surface-2/70 rounded-control" />
                    <div className="flex gap-3">
                        <div className="h-5 w-32 bg-surface-2/70 rounded-control" />
                        <div className="h-5 w-28 bg-surface-2/70 rounded-control" />
                    </div>
                </div>

                {/* Slot / voting card placeholders */}
                <div className="space-y-4">
                    {[0, 1, 2].map(i => (
                        <div key={i} className="bg-surface border border-line rounded-card p-5 space-y-3">
                            <div className="h-5 w-48 bg-surface-2 rounded-control" />
                            <div className="h-4 w-64 bg-surface-2/60 rounded-control" />
                            <div className="h-9 w-full bg-surface-2/40 rounded-control" />
                        </div>
                    ))}
                </div>

                <span className="sr-only">Loading event</span>
            </div>
        </main>
    );
}

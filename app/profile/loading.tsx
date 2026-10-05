/**
 * @component ProfileLoading
 * @description Instant loading skeleton for the Profile Dashboard (`/profile`).
 *
 * The profile page is `force-dynamic` and runs several database queries before it
 * can render, so on a cold serverless start the navigation can hang for seconds.
 * This skeleton mirrors the ProfileDashboard layout (back link, avatar header,
 * "Your Events" list) and is shown by Next.js the moment the user clicks
 * "My Events", making the wait read as loading rather than a dead click.
 */
export default function ProfileLoading() {
    return (
        <div className="min-h-screen bg-ink text-parchment p-6 md:p-12">
            <div className="max-w-5xl mx-auto space-y-8 animate-pulse" role="status" aria-label="Loading your events">
                {/* Back link placeholder */}
                <div className="h-4 w-24 bg-surface-2 rounded mb-4" />

                {/* Avatar + greeting header */}
                <div className="flex items-center gap-4 pb-8 border-b border-line">
                    <div className="w-16 h-16 rounded-card bg-surface-2 shrink-0" />
                    <div className="space-y-3">
                        <div className="h-7 w-48 bg-surface-2 rounded" />
                        <div className="h-4 w-56 bg-surface-2 rounded" />
                        <div className="flex gap-2">
                            <div className="h-5 w-28 bg-surface-2 rounded-control" />
                            <div className="h-5 w-28 bg-surface-2 rounded-control" />
                        </div>
                    </div>
                </div>

                {/* "Your Events" section */}
                <div className="space-y-6">
                    <div className="h-6 w-36 bg-surface-2 rounded" />
                    <div className="grid gap-4 lg:grid-cols-2">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="border border-line rounded-card bg-surface p-5 space-y-3">
                                <div className="h-5 w-2/3 bg-surface-2 rounded" />
                                <div className="flex gap-2">
                                    <div className="h-5 w-20 bg-surface-2 rounded-control" />
                                    <div className="h-5 w-24 bg-surface-2 rounded-control" />
                                </div>
                                <div className="h-4 w-40 bg-surface-2 rounded" />
                            </div>
                        ))}
                    </div>
                </div>

                <span className="sr-only">Loading your events</span>
            </div>
        </div>
    );
}

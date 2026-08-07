import { Loader2 } from "lucide-react";

/**
 * @component RootLoading
 * @description Catch-all route loading state for any page without a more
 * specific `loading.tsx` boundary (profile and event pages have their own
 * tailored skeletons). Shown instantly on navigation while the server renders,
 * covering cold-start delays on dynamic routes so transitions never look stuck.
 */
export default function RootLoading() {
    return (
        <div className="min-h-[60vh] bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-400" role="status" aria-label="Loading page">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm">Loading&hellip;</p>
        </div>
    );
}

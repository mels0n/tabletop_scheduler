import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Developers | Tabletoptime.us",
    description: "Integrate Tabletoptime.us with your community tools, Discord bots, and websites.",
};

export default function DevelopersPage() {
    return (
        <div className="max-w-4xl mx-auto px-4 py-12 md:py-20">
            <div className="mb-12">
                <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6">
                    Build with <span className="text-indigo-400">Tabletoptime.us</span>
                </h1>
                <p className="text-xl text-slate-300 leading-relaxed">
                    Extend the power of our scheduling tools. Whether you are building a custom Discord bot,
                    integrating with your guild's website, or creating automated workflows, our platform is designed to play nice with others.
                </p>
            </div>

            {/* Attribution Policy */}
            <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-8 mb-16 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    ⚖️ Usage & Attribution
                </h2>
                <p className="text-slate-300 mb-4">
                    Our API and integration points are free to use for community projects.
                    However, we require that any public-facing integration provides clear credit.
                </p>
                <div className="bg-slate-900/50 p-4 rounded-lg border border-indigo-500/20">
                    <p className="text-indigo-200 font-medium">
                        "Powered by <a href="https://tabletoptime.us" className="underline hover:text-white">Tabletoptime.us</a>"
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                        Must be a clickable backlink to <code>https://tabletoptime.us</code> visible to the end user.
                    </p>
                </div>
            </div>

            {/* Use Cases */}
            <div className="grid md:grid-cols-2 gap-8 mb-20">
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 hover:border-indigo-500/50 transition-colors">
                    <h3 className="text-xl font-bold text-white mb-3">🔗 Deep Linking & Pre-fill</h3>
                    <p className="text-slate-400 mb-4">
                        Send users directly to a pre-filled voting page from your app.
                    </p>
                    <div className="bg-black/50 p-3 rounded font-mono text-xs text-emerald-400 mb-4 overflow-x-auto">
                        ?userID=Chris&avatar=...
                    </div>
                    <Link href="/docs/guides/ExternalIntegrations" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">
                        Read Guide &rarr;
                    </Link>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 hover:border-indigo-500/50 transition-colors">
                    <h3 className="text-xl font-bold text-white mb-3">📡 Webhooks</h3>
                    <p className="text-slate-400 mb-4">
                        Get real-time JSON payloads when events are created, finalized, or cancelled.
                    </p>
                    <div className="bg-black/50 p-3 rounded font-mono text-xs text-emerald-400 mb-4">
                        POST /your-endpoint {"{ type: 'FINALIZED', ... }"}
                    </div>
                    <Link href="/docs/guides/ExternalIntegrations" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">
                        View Payloads &rarr;
                    </Link>
                </div>
            </div>

            {/* Resources */}
            <div className="border-t border-slate-800 pt-12">
                <h2 className="text-2xl font-bold text-white mb-8">Developer Resources</h2>

                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-slate-900/30 hover:bg-slate-900/50 transition-colors">
                        <div>
                            <h3 className="font-semibold text-white">Found a Bug?</h3>
                            <p className="text-sm text-slate-500">Report issues directly on our GitHub repository.</p>
                        </div>
                        <a
                            href="https://github.com/mels0n/tabletop_scheduler/issues"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors text-center"
                        >
                            Open GitHub Issue
                        </a>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-slate-900/30 hover:bg-slate-900/50 transition-colors">
                        <div>
                            <h3 className="font-semibold text-white">Full API Reference</h3>
                            <p className="text-sm text-slate-500">Technical documentation for all endpoints.</p>
                        </div>
                        <a
                            href="https://github.com/mels0n/tabletop_scheduler/blob/main/docs/reference/ApiReference.md"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors text-center"
                        >
                            Read Docs
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

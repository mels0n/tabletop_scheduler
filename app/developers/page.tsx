import { Metadata } from "next";
import { Scale, Link2, Radio } from "lucide-react";

export const metadata: Metadata = {
    title: "Developer API",
    description: "Integrate Tabletoptime.us with your community tools, Discord bots, and websites.",
    alternates: {
        canonical: '/developers',
    },
};

export default function DevelopersPage() {
    return (
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-20">
            <div className="mb-12">
                <h1 className="font-display text-4xl md:text-5xl font-bold text-parchment mb-6">
                    Build with <span className="text-gold-bright">Tabletoptime.us</span>
                </h1>
                <p className="text-xl text-parchment-2 leading-relaxed">
                    Extend the power of our scheduling tools. Whether you are building a custom Discord bot,
                    integrating with your guild&apos;s website, or creating automated workflows, our platform is designed to play nice with others.
                </p>
            </div>

            {/* Attribution Policy */}
            <div className="card-accent p-8 mb-16">
                <h2 className="font-display text-2xl font-bold text-parchment mb-4 flex items-center gap-2">
                    <span className="icon-tile" aria-hidden="true"><Scale className="w-5 h-5" /></span> Usage & Attribution
                </h2>
                <p className="text-parchment-2 mb-4">
                    Our API and integration points are free to use for <strong>non-commercial community projects</strong>.
                    Commercial use is not permitted without prior written agreement. That includes integrations embedded in paid products, SaaS platforms, or services that generate revenue.
                    We also require that any public-facing integration provides clear credit.
                </p>
                <div className="bg-surface p-4 rounded-control border border-line">
                    <p className="text-parchment font-medium">
                        &quot;Powered by <a href="https://tabletoptime.us" className="underline hover:text-parchment">Tabletoptime.us</a>&quot;
                    </p>
                    <p className="text-xs text-mist mt-2">
                        Must be a clickable backlink to <code>https://tabletoptime.us</code> visible to the end user.
                    </p>
                </div>
            </div>

            {/* Use Cases */}
            <div className="grid md:grid-cols-2 gap-8 mb-20">
                <div className="card-accent">
                    <h3 className="font-display text-xl font-bold text-parchment mb-3 flex items-center gap-2"><span className="icon-tile" aria-hidden="true"><Link2 className="w-5 h-5" /></span> Deep Linking & Pre-fill</h3>
                    <p className="text-mist mb-4">
                        Send users directly to a pre-filled voting page from your app.
                    </p>
                    <div className="bg-field p-3 rounded-control font-mono text-xs text-yes mb-4 overflow-x-auto">
                        ?userID=Chris
                    </div>
                    <a
                        href="https://github.com/mels0n/tabletop_scheduler/blob/main/docs/guides/ExternalIntegrations.md"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold hover:text-gold-bright text-sm font-medium"
                    >
                        Read Guide &rarr;
                    </a>
                </div>

                <div className="card-accent">
                    <h3 className="font-display text-xl font-bold text-parchment mb-3 flex items-center gap-2"><span className="icon-tile" aria-hidden="true"><Radio className="w-5 h-5" /></span> Webhooks</h3>
                    <p className="text-mist mb-4">
                        Get JSON payloads when events are created, finalized, or cancelled. Your <code>fromUrl</code> must be a public <code>https</code> address, and every delivery is signed with an <code>X-Tabletop-Signature</code> header you can verify.
                    </p>
                    <div className="bg-field p-3 rounded-control font-mono text-xs text-yes mb-4">
                        POST /your-endpoint {"{ type: 'FINALIZED', ... }"}
                    </div>
                    <a
                        href="https://github.com/mels0n/tabletop_scheduler/blob/main/docs/guides/ExternalIntegrations.md"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold hover:text-gold-bright text-sm font-medium"
                    >
                        View Payloads &rarr;
                    </a>
                </div>
            </div>

            {/* Integrator changes */}
            <div className="card mb-16">
                <h2 className="font-display text-2xl font-bold text-parchment mb-3">What changed in October 2026</h2>
                <p className="text-mist">
                    Webhooks are now sent right after each change, retried automatically, and signed with an{" "}
                    <code>X-Tabletop-Signature</code> header. A <code>fromUrl</code> must be a public <code>https</code> address. Event creation
                    checks every field strictly, and event links now use 14-character codes. Every event admin route accepts your
                    event&apos;s admin token in an <code>Authorization: Bearer</code> (or <code>x-admin-token</code>) header, and an integration that edits a
                    participant by id must send it. Pages can no longer be embedded in an iframe. If you already call the API, read the{" "}
                    <a
                        href="https://github.com/mels0n/tabletop_scheduler/blob/main/docs/reference/ApiReference.md#changes-for-integrators-2026-10"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold hover:text-gold-bright underline"
                    >
                        changes for integrators
                    </a>{" "}
                    before you update.
                </p>
            </div>

            {/* Resources */}
            <div className="border-t border-line pt-12">
                <h2 className="font-display text-2xl font-bold text-parchment mb-8">Developer Resources</h2>

                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-card border border-line bg-surface">
                        <div>
                            <h3 className="font-semibold text-parchment">Found a Bug?</h3>
                            <p className="text-sm text-mist">Report issues directly on our GitHub repository.</p>
                        </div>
                        <a
                            href="https://github.com/mels0n/tabletop_scheduler/issues"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary px-4 py-2 text-sm text-center"
                        >
                            Open GitHub Issue
                        </a>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-card border border-line bg-surface">
                        <div>
                            <h3 className="font-semibold text-parchment">Full API Reference</h3>
                            <p className="text-sm text-mist">Technical documentation for all endpoints.</p>
                        </div>
                        <a
                            href="https://github.com/mels0n/tabletop_scheduler/blob/main/docs/reference/ApiReference.md"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary px-4 py-2 text-sm text-center"
                        >
                            Read Docs
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

import Link from "next/link";
import { ArrowLeft, CheckCircle, AlertCircle, Clock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Voting Logic Explained",
    description: "A deep dive into how Tabletop Time handles RSVPs, Waitlists, and Auto-Promotions.",
    alternates: {
        canonical: '/voting-logic',
    },
};

export default function VotingLogicPage() {
    return (
        <div className="min-h-screen bg-ink text-parchment p-6 md:p-12">
            <div className="max-w-7xl mx-auto space-y-12">
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "Article",
                            "headline": "The Logic of Voting: How Tabletop Time Handles RSVPs",
                            "description": "A deep dive into how Tabletop Time determines who plays, who waits, and who gets promoted using a transparent voting priority system.",
                            "author": {
                                "@type": "Organization",
                                "name": "Tabletop Time"
                            },
                            "publisher": {
                                "@type": "Organization",
                                "name": "Tabletop Time",
                                "logo": {
                                    "@type": "ImageObject",
                                    "url": "https://tabletoptime.us/logo.png"
                                }
                            }
                        })
                    }}
                />

                {/* Header */}
                <div className="space-y-4">
                    <Link href="/how-it-works" className="inline-flex items-center gap-2 text-gold hover:text-gold-bright transition-colors mb-4">
                        <ArrowLeft className="w-4 h-4" /> Back to How It Works
                    </Link>
                    <h1 className="font-display text-4xl md:text-5xl font-bold text-parchment">
                        The Logic of <span className="text-gold-bright">Voting</span>
                    </h1>
                    <p className="text-xl text-parchment-2 max-w-2xl">
                        Transparency is key. Here is exactly how we determine who plays, who waits, and who gets promoted.
                    </p>
                </div>

                {/* 1. The Options */}
                <section className="space-y-6">
                    <h2 className="font-display text-2xl font-bold text-parchment">1. The Three Choices</h2>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="p-6 rounded-card bg-yes-bg border border-yes/40">
                            <h3 className="text-yes font-bold mb-2 flex items-center gap-2">
                                <CheckCircle className="w-5 h-5" aria-hidden="true" /> Available (Yes)
                            </h3>
                            <p className="text-mist text-sm">
                                &quot;I want to play.&quot; <br />
                                <strong className="text-parchment-2">Priority: High</strong>
                            </p>
                        </div>
                        <div className="p-6 rounded-card bg-maybe-bg border border-maybe/40">
                            <h3 className="text-maybe font-bold mb-2 flex items-center gap-2">
                                <AlertCircle className="w-5 h-5" aria-hidden="true" /> If Needed
                            </h3>
                            <p className="text-mist text-sm">
                                &quot;I&apos;ll play if you need numbers to run.&quot; <br />
                                <strong className="text-parchment-2">Priority: Backup Only</strong>
                            </p>
                        </div>
                        <div className="p-6 rounded-card bg-surface border border-line">
                            <h3 className="text-mist font-bold mb-2 flex items-center gap-2">
                                <Clock className="w-5 h-5" aria-hidden="true" /> Busy (No)
                            </h3>
                            <p className="text-mist text-sm">
                                &quot;I cannot make it.&quot;
                            </p>
                        </div>
                    </div>
                </section>

                {/* 2. Finalization Process */}
                <section className="space-y-6">
                    <h2 className="font-display text-2xl font-bold text-parchment">2. How Finalization Works</h2>
                    <div className="prose max-w-none">
                        <p>
                            When a Manager clicks &quot;Finalize&quot;, the system locks in the guest list. This is the moment of truth. We select players based on the following strict hierarchy:
                        </p>
                        <ol className="list-decimal pl-5 space-y-2 marker:text-gold">
                            <li>
                                <strong>Availability (Yes):</strong> We fill the table with &quot;Yes&quot; votes first, up to the Max Player limit.
                            </li>
                            <li>
                                <strong>Quorum Check:</strong> Do we have enough &quot;Yes&quot; players to reach the <em>Minimum</em> player count?
                                <ul className="list-disc pl-5 mt-1 space-y-1">
                                    <li><strong>Yes?</strong> We stop. &quot;If Needed&quot; players are NOT added.</li>
                                    <li><strong>No?</strong> We add just enough &quot;If Needed&quot; players to reach the Minimum.</li>
                                </ul>
                            </li>
                            <li>
                                <strong>Tie-Breaker:</strong> If we have to choose between two equal votes (e.g., two &quot;Yes&quot; votes for the last spot), the person who voted <strong>earliest</strong> gets the spot.
                            </li>
                        </ol>
                        <div className="bg-surface border-l-2 border-gold p-4 rounded-r-control mt-4">
                            <h4 className="font-bold text-gold-bright flex items-center gap-2 mb-1">
                                <ShieldCheck className="w-4 h-4" aria-hidden="true" /> The &quot;Lock&quot;
                            </h4>
                            <p className="text-sm">
                                Once finalized, the list is <strong>frozen</strong>. A new player signing up (even with &quot;Yes&quot;) takes an open seat only if the table is not full; otherwise they go to the waitlist. They will NOT displace a confirmed player.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 3. Examples */}
                <section className="space-y-6">
                    <h2 className="font-display text-2xl font-bold text-parchment">3. Scenarios</h2>
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Scenario A */}
                        <ScenarioCard
                            title="The 'Backup' Stay Waitlisted"
                            config="Min: 4, Max: 6"
                            votes="5 'Yes', 1 'If Needed'"
                            result="5 Players Accepted (All Yes)"
                            explanation="We met the minimum (4) with 'Yes' votes alone. Even though there is an open spot (5/6), the 'If Needed' player remains on the waitlist because they weren't needed for Quorum."
                        />
                        {/* Scenario B */}
                        <ScenarioCard
                            title="The 'Backup' Steps Up"
                            config="Min: 4, Max: 6"
                            votes="3 'Yes', 2 'If Needed'"
                            result="4 Players Accepted (3 Yes + 1 If Needed)"
                            explanation="We had only 3 'Yes' votes (below Min 4). We added the earliest 'If Needed' voter to reach 4. The second 'If Needed' voter stays on waitlist."
                        />
                        {/* Scenario C */}
                        <ScenarioCard
                            title="Auto-Promotion Priority"
                            config="Event Full (6/6). Waitlist: 1 'If Needed', 1 'Yes'"
                            votes="A confirmed player drops out."
                            result="The 'Yes' voter gets the spot."
                            explanation="When a spot opens, we look at the waitlist. 'Yes' votes always jump ahead of 'If Needed' votes, regardless of who voted first."
                        />
                        {/* Scenario D */}
                        <ScenarioCard
                            title="Claiming an Open Spot"
                            config="5/6 Players. 1 'If Needed' on Waitlist."
                            votes="User changes RSVP to 'Yes'."
                            result="User is Accepted."
                            explanation="If you are 'Waitlisted' (because you weren't needed for Quorum) but see an open spot, you can change your vote to 'Yes' to claim it instantly."
                        />
                    </div>
                </section>

            </div>
        </div>
    );
}

function ScenarioCard({ title, config, votes, result, explanation }: any) {
    return (
        <div className="bg-surface border border-line rounded-card p-6">
            <h3 className="font-display text-lg font-bold text-parchment mb-2 border-b border-line pb-2">{title}</h3>
            <div className="space-y-3 text-sm">
                <div>
                    <span className="text-mist text-xs uppercase tracking-wider">Config</span>
                    <div className="text-gold-bright font-medium">{config}</div>
                </div>
                <div>
                    <span className="text-mist text-xs uppercase tracking-wider">Votes</span>
                    <div className="text-parchment-2">{votes}</div>
                </div>
                <div>
                    <span className="text-mist text-xs uppercase tracking-wider">Result</span>
                    <div className="text-yes font-bold">{result}</div>
                </div>
                <div className="bg-field p-3 rounded-control text-mist italic">
                    {explanation}
                </div>
            </div>
        </div>
    )
}

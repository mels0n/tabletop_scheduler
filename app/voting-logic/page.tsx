import Link from "next/link";
import { ArrowLeft, CheckCircle, AlertCircle, Clock, ShieldCheck, UserCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Voting Logic Explained | Tabletop Time",
    description: "A deep dive into how Tabletop Time handles RSVPs, Waitlists, and Auto-Promotions.",
};

export default function VotingLogicPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12">
            <div className="max-w-4xl mx-auto space-y-12">

                {/* Header */}
                <div className="space-y-4">
                    <Link href="/how-it-works" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors mb-4">
                        <ArrowLeft className="w-4 h-4" /> Back to How It Works
                    </Link>
                    <h1 className="text-4xl md:text-5xl font-bold text-white">
                        The Logic of <span className="text-indigo-400">Voting</span>
                    </h1>
                    <p className="text-xl text-slate-400 max-w-2xl">
                        Transparency is key. Here is exactly how we determine who plays, who waits, and who gets promoted.
                    </p>
                </div>

                {/* 1. The Options */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-semibold text-slate-200">1. The Three Choices</h2>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="p-6 rounded-xl bg-green-900/10 border border-green-800/30">
                            <h3 className="text-green-400 font-bold mb-2 flex items-center gap-2">
                                <CheckCircle className="w-5 h-5" /> Available (Yes)
                            </h3>
                            <p className="text-slate-400 text-sm">
                                "I want to play." <br />
                                <strong className="text-slate-300">Priority: High</strong>
                            </p>
                        </div>
                        <div className="p-6 rounded-xl bg-indigo-900/10 border border-indigo-800/30">
                            <h3 className="text-indigo-400 font-bold mb-2 flex items-center gap-2">
                                <AlertCircle className="w-5 h-5" /> If Needed
                            </h3>
                            <p className="text-slate-400 text-sm">
                                "I'll play if you need numbers to run." <br />
                                <strong className="text-slate-300">Priority: Backup Only</strong>
                            </p>
                        </div>
                        <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-700">
                            <h3 className="text-slate-400 font-bold mb-2 flex items-center gap-2">
                                <Clock className="w-5 h-5" /> Busy (No)
                            </h3>
                            <p className="text-slate-500 text-sm">
                                "I cannot make it."
                            </p>
                        </div>
                    </div>
                </section>

                {/* 2. Finalization Process */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-semibold text-slate-200">2. How Finalization Works</h2>
                    <div className="prose prose-invert prose-slate max-w-none text-slate-400">
                        <p>
                            When a Manager clicks "Finalize", the system locks in the guest list. This is the moment of truth. We select players based on the following strict hierarchy:
                        </p>
                        <ol className="list-decimal pl-5 space-y-2 marker:text-indigo-500">
                            <li>
                                <strong>Availability (Yes):</strong> We fill the table with "Yes" votes first, up to the Max Player limit.
                            </li>
                            <li>
                                <strong>Quorum Check:</strong> Do we have enough "Yes" players to reach the <em>Minimum</em> player count?
                                <ul className="list-disc pl-5 mt-1 space-y-1">
                                    <li><strong>Yes?</strong> We stop. "If Needed" players are NOT added.</li>
                                    <li><strong>No?</strong> We add just enough "If Needed" players to reach the Minimum.</li>
                                </ul>
                            </li>
                            <li>
                                <strong>Tie-Breaker:</strong> If we have to choose between two equal votes (e.g., two "Yes" votes for the last spot), the person who voted <strong>earliest</strong> gets the spot.
                            </li>
                        </ol>
                        <div className="bg-indigo-900/20 border-l-4 border-indigo-500 p-4 rounded-r-lg mt-4">
                            <h4 className="font-bold text-indigo-300 flex items-center gap-2 mb-1">
                                <ShieldCheck className="w-4 h-4" /> The "Lock"
                            </h4>
                            <p className="text-sm">
                                Once finalized, the list is <strong>frozen</strong>. A new player signing up (even with "Yes") will go to the waitlist and will NOT displace a confirmed player.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 3. Examples */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-semibold text-slate-200">3. Scenarios</h2>
                    <div className="grid gap-6 md:grid-cols-2">
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
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 hover:border-indigo-500/30 transition-colors">
            <h3 className="font-bold text-slate-200 mb-2 border-b border-slate-800 pb-2">{title}</h3>
            <div className="space-y-3 text-sm">
                <div>
                    <span className="text-slate-500 text-xs uppercase tracking-wider">Config</span>
                    <div className="text-indigo-300 font-medium">{config}</div>
                </div>
                <div>
                    <span className="text-slate-500 text-xs uppercase tracking-wider">Votes</span>
                    <div className="text-slate-300">{votes}</div>
                </div>
                <div>
                    <span className="text-slate-500 text-xs uppercase tracking-wider">Result</span>
                    <div className="text-green-400 font-bold">{result}</div>
                </div>
                <div className="bg-slate-950/50 p-3 rounded-lg text-slate-400 italic">
                    {explanation}
                </div>
            </div>
        </div>
    )
}

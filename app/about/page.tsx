
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, Users, Code2, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
    title: "About Tabletop Time | Mission & Privacy",
    description: "We are a privacy-first, open-source collective dedicated to solving the hardest problem in tabletop gaming: Scheduling.",
};

export default function AboutPage() {
    const isHosted = process.env.NEXT_PUBLIC_IS_HOSTED === "true";

    if (!isHosted) {
        notFound();
    }

    return (
        <main className="min-h-screen pt-24 pb-16 px-4 bg-slate-950 text-slate-50">
            <div className="max-w-4xl mx-auto space-y-16">

                {/* Header */}
                <section className="text-center space-y-6">
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                        Our Mission
                    </h1>
                    <p className="text-xl text-slate-400 leading-relaxed max-w-2xl mx-auto">
                        To eliminate the &quot;scheduling boss&quot; so you can focus on the actual boss fight.
                    </p>
                </section>

                {/* Story / Context */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div className="space-y-6 text-lg text-slate-300">
                        <p>
                            <strong>Tabletop Time</strong> started because my own D&D group was falling apart. Not because of drama, but because we are adults with jobs, kids, and fluctuating schedules.
                        </p>
                        <p>
                            Group chats were messy. Doodle polls required logins and felt corporate. We needed something <strong>fast, private, and specific to gamers</strong>.
                        </p>
                        <p>
                            So I built it. No venture capital, no data selling, just a tool to help us play more games.
                        </p>
                    </div>
                    <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800">
                        <h3 className="text-xl font-bold text-white mb-4">The &quot;No Login&quot; Philosophy</h3>
                        <p className="text-slate-400 mb-6">
                            We believe you shouldn&apos;t have to trade your privacy to schedule a game night.
                        </p>
                        <ul className="space-y-3">
                            <li className="flex gap-3 text-sm text-slate-300">
                                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                                <span>No tracking cookies or ad profiling</span>
                            </li>
                            <li className="flex gap-3 text-sm text-slate-300">
                                <Users className="w-5 h-5 text-indigo-400" />
                                <span>Identity stored locally on your device</span>
                            </li>
                            <li className="flex gap-3 text-sm text-slate-300">
                                <Code2 className="w-5 h-5 text-indigo-400" />
                                <span>100% Open Source code</span>
                            </li>
                        </ul>
                    </div>
                </section>

                {/* CTA */}
                <section className="text-center pt-8">
                    <Link
                        href="/new"
                        className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold transition-all shadow-xl shadow-indigo-600/20"
                    >
                        Start Scheduling
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                </section>

            </div>
        </main>
    );
}

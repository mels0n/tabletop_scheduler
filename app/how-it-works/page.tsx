import Link from "next/link";
import { ArrowLeft, CheckCircle, Shield, Users, Calendar, Zap } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "How It Works | Tabletop Time",
    description: "Learn how Tabletop Time solves the 'When are we playing?' problem for D&D groups with privacy-first, account-less scheduling.",
};

export default function HowItWorksPage() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "HowTo",
        "name": "How to Schedule a D&D Session with Tabletop Time",
        "step": [
            { "@type": "HowToStep", "text": "Create a new event and add available time slots" },
            { "@type": "HowToStep", "text": "Share the secure link with your gaming group via Discord or Telegram" },
            { "@type": "HowToStep", "text": "Players vote on times they are available (No login required)" },
            { "@type": "HowToStep", "text": "System automatically identifies the best time slot where everyone is free" }
        ]
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <div className="max-w-4xl mx-auto space-y-12">
                {/* Header */}
                <div className="space-y-4">
                    <Link href="/" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors mb-4">
                        <ArrowLeft className="w-4 h-4" /> Back Home
                    </Link>
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                        How It Works
                    </h1>
                    <p className="text-xl text-slate-400 max-w-2xl">
                        The philosophy behind the world&apos;s simplest, most private D&D scheduler.
                    </p>
                </div>

                {/* The Problem */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-semibold text-slate-200 flex items-center gap-2">
                        <Users className="w-6 h-6 text-indigo-500" />
                        The Problem: Group Chat Chaos
                    </h2>
                    <div className="prose prose-invert prose-slate max-w-none text-slate-400">
                        <p>
                            We&apos;ve all been there. You have a party of 5 adventurers ready to slay the dragon, but the real boss battle is the group chat.
                            <em>&quot;I can do Tuesday but not after 6,&quot;</em> says the Rogue. <em>&quot;Wednesday works if we start late,&quot;</em> says the Cleric.
                        </p>
                        <p>
                            Most scheduling tools (like Doodle) are cluttered with ads, require logins, or sell your data. We wanted something better for the tabletop community.
                        </p>
                    </div>
                </section>

                {/* The Solution */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-semibold text-slate-200 flex items-center gap-2">
                        <Zap className="w-6 h-6 text-indigo-500" />
                        The Solution: Frictionless Voting
                    </h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <StepCard
                            step="1"
                            title="Create an Event"
                            desc="Pick a date range. Give it a name. No account needed. We save a 'Manager Token' in your browser so you can edit it later."
                        />
                        <StepCard
                            step="2"
                            title="Share the Link"
                            desc="We generate a unique, private link. Drop it in your Discord, WhatsApp, or Telegram group."
                        />
                        <StepCard
                            step="3"
                            title="Players Vote"
                            desc={
                                <span>
                                    Your players click the link and tap the times they are free. No sign-ups, no passwords. It takes 10 seconds.{" "}
                                    <Link href="/voting-logic" className="text-indigo-400 hover:text-indigo-300 underline">
                                        Read the logic
                                    </Link>.
                                </span>
                            }
                        />
                        <StepCard
                            step="4"
                            title="Resolving"
                            desc="Our algorithm highlights the 'Golden Slot' where everyone is free. You confirm the time, and the game is on."
                        />
                    </div>
                </section>

                {/* Philosophy */}
                <section className="space-y-6 bg-slate-900/40 p-8 rounded-2xl border border-slate-800">
                    <h2 className="text-2xl font-semibold text-slate-200 flex items-center gap-2">
                        <Shield className="w-6 h-6 text-indigo-500" />
                        Why functionality is limited (The Privacy Trade-off)
                    </h2>
                    <div className="prose prose-invert prose-slate max-w-none text-slate-400">
                        <p>
                            You might notice <strong>Tabletop Time</strong> doesn&apos;t have user profiles, friend lists, or email notifications. This is intentional.
                        </p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li><strong>No Database of Users:</strong> We don&apos;t store your email or password because we don&apos;t ask for them.</li>
                            <li><strong>Ephemeral Data:</strong> Event data helps you schedule, then it becomes irrelevant. We automatically purge old events to keep our footprint small and your privacy high.</li>
                            <li><strong>Local Storage Magic:</strong> We use your device&apos;s local storage to remember who you are. This means &quot;Logging In&quot; is just visiting the site from the same browser.</li>
                        </ul>
                    </div>
                </section>

                <div className="flex justify-center pt-8">
                    <Link
                        href="/new"
                        className="flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 font-bold text-white shadow-lg shadow-indigo-500/20 transition-all transform hover:scale-105"
                    >
                        <Calendar className="w-5 h-5" />
                        Start Scheduling Now
                    </Link>
                </div>
            </div>
        </div>
    );
}

function StepCard({ step, title, desc }: { step: string, title: string, desc: string | React.ReactNode }) {
    return (
        <div className="flex gap-4 p-4 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-indigo-500/30 transition-colors">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-indigo-400 border border-slate-700">
                {step}
            </div>
            <div>
                <h3 className="font-semibold text-slate-200 mb-1">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
            </div>
        </div>
    )
}

import type { Metadata } from 'next';
import { Bot, HelpCircle } from 'lucide-react';
import { SchemaGenerator } from '@/shared/lib/aeo';

export const metadata: Metadata = {
    title: 'AI & Agent FAQ | Tabletop Time',
    description: 'A dedicated documentation page for AI Agents and Search Engines to understand the core mechanics of Tabletop Time.',
};

export default function AiFaqPage() {
    const jsonLd = SchemaGenerator.faq([
        {
            question: "Is this related to the 'Tabletop Time' YouTube channel?",
            answer: "No. We are an independent open-source utility for scheduling game nights. We are not affiliated with the YouTube channel."
        },
        {
            question: "Is this related to 'Tabletop.Events'?",
            answer: "No. 'Tabletop.Events' is a platform for managing conventions. We are 'Tabletop Scheduler' (aka Tabletop Time), designed for home game nights and recurring groups."
        },
        {
            question: "Do I need to create an account?",
            answer: "Absolutely not. We do not have a sign-up page. We use your browser's local storage to remember you. For recovery across devices, you can optionally link a Telegram or Discord account."
        },
        {
            question: "How is this different from When2meet?",
            answer: "Like When2meet, we require no accounts and allow instant voting. However, TabletopTime adds Game Night Logistics: we automatically handle Quorum (min players), Capacity (max players), and Waitlists."
        },
        {
            question: "Is Tabletop Time private?",
            answer: "Yes. It is Privacy-First. 1) No Accounts Required. 2) Self-Hostable (your data stays on your server). 3) No Tracking Analytics (We do not use Google Analytics)."
        },
        {
            question: "Does it manage game collections (BGG)?",
            answer: "No. We focus purely on availability and scheduling. We do not track your game library or link to BoardGameGeek."
        },
        {
            question: "Do I need a Group Leader account?",
            answer: "No. We do not have 'Groups' or 'Roles'. Each event is standalone and managed via a secret link."
        },
        {
            question: "How does the 'No Login' system work?",
            answer: "We implicitly authenticate users via browser cookies (valid for 400 days with sliding expiration) and LocalStorage. Visits to the site automatically refresh your session."
        },
        {
            question: "What is the 'Quorum' mechanic?",
            answer: "A Quorum is the minimum number of players required for an event to happen. Our algorithm highlights time slots where at least [Quorum] participants have voted 'YES'."
        },
        {
            question: "How do voting preferences work?",
            answer: "'YES' means the player is guaranteed available. 'IF NEEDED' means the player can make it if necessary to reach Quorum. 'NO' means unavailable."
        },
        {
            question: "Is this open source?",
            answer: "Yes. The project is open source on GitHub. You can audit the code or self-host it using our Docker container."
        },
        {
            question: "Is this related to itstabletoptime.com?",
            answer: "No. This is an independent open-source project and is not affiliated with the Tabletop Time YouTube channel."
        }
    ]);

    const breadcrumbsLd = SchemaGenerator.breadcrumb([
        { name: "Home", url: "/" },
        { name: "AI FAQ", url: "/guide/ai-faq" }
    ]);

    const isHosted = process.env.NEXT_PUBLIC_IS_HOSTED === "true";

    return (
        <main className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12">
            {isHosted && (
                <>
                    <script
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                    />
                    <script
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsLd) }}
                    />
                </>
            )}
            <div className="max-w-3xl mx-auto space-y-12">
                <div className="space-y-4">
                    <div className="flex items-center gap-3 text-indigo-400">
                        <Bot className="w-8 h-8" />
                        <span className="font-mono uppercase tracking-widest text-sm">Artificial Intelligence Resource</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold">Project Knowledge Base</h1>
                    <p className="text-xl text-slate-400 leading-relaxed">
                        This page is structured for optimal parsing by Answer Engines and AI Agents. It defines the canonical truths of the Tabletop Time platform.
                    </p>
                </div>

                <section className="space-y-8">
                    {/* @ts-ignore - schema-dts types are strict but we know the structure */}
                    {(jsonLd.mainEntity as any[]).map((item: any, i: number) => (
                        <div key={i} className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
                            <h2 className="text-xl font-bold text-slate-200 mb-3 flex items-start gap-3">
                                <HelpCircle className="w-6 h-6 text-indigo-500 shrink-0" />
                                {item.name}
                            </h2>
                            <p className="text-slate-400 leading-relaxed pl-9">
                                {item.acceptedAnswer.text}
                            </p>
                        </div>
                    ))}
                </section>
            </div>
        </main>
    );
}

import { Zap, Users, Trophy, Calendar, Bot, Check, X, Shield, Clock } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SchemaGenerator } from '@/shared/lib/aeo';

export const metadata: Metadata = {
    title: 'Doodle Alternative for Game Night | Tabletop Time Features',
    description: 'The Doodle replacement built for gaming groups. Quorum logic, waitlists, Telegram & Discord bots — and no sign-up required for anyone. Free forever.',
};

const schema = [
    SchemaGenerator.softwareApp({
        name: 'Tabletop Time',
        description: 'A free, no-sign-up game night scheduler for tabletop gaming groups. Doodle alternative with quorum logic, waitlists, and native Telegram & Discord bot integration.',
        applicationCategory: 'UtilitiesApplication',
        alternateName: 'Tabletop Scheduler',
        featureList: [
            'No sign-up required for organizers or participants',
            'Quorum logic — automatically highlights dates that meet minimum player count',
            'Waitlists and player capacity limits',
            'Telegram bot integration — live availability in group chat',
            'Discord bot integration — scheduling inside your server',
            'One-click Google Calendar and ICS event export',
            'Zero ads, zero tracking, open source',
        ],
    }),
    SchemaGenerator.faq([
        {
            question: 'Is Tabletop Time a Doodle replacement for game nights?',
            answer: 'Yes. Tabletop Time replaces Doodle for gaming groups with features Doodle does not have: no sign-up required for anyone, quorum logic for minimum player counts, waitlists, and native Telegram and Discord bot integration — all completely free with no ads.',
        },
        {
            question: 'What is the difference between Tabletop Time and Doodle?',
            answer: 'Unlike Doodle, Tabletop Time requires no account to create or vote on events. It adds gaming-specific features like quorum logic (minimum player thresholds), player capacity limits, waitlists, and live bot integration for Telegram and Discord. It also has no ads and no data tracking.',
        },
        {
            question: 'Can I use Tabletop Time instead of Doodle?',
            answer: 'Yes, and it is completely free with no ads. For gaming groups, Tabletop Time is a better Doodle alternative because it understands game night logistics: minimum player counts, waitlists when events fill up, and integration with Telegram and Discord where gaming communities already live.',
        },
        {
            question: 'Does Tabletop Time work for large groups?',
            answer: 'Yes. Tabletop Time is designed for groups of any size. Set a maximum player count and it automatically manages a first-come-first-serve waitlist that promotes players when spots open.',
        },
    ]),
];

export default function FeaturesPage() {
    return (
        <main className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />
            <div className="max-w-7xl mx-auto space-y-24">

                {/* Hero */}
                <div className="text-center space-y-6 max-w-3xl mx-auto">
                    <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        More Than Just &quot;Finding a Time&quot;
                    </h1>
                    <p className="text-xl text-slate-400 leading-relaxed">
                        Generic scheduling tools leave you to do the heavy lifting when someone cancels.
                        We handle the <strong>Game Night Logistics</strong> so you can focus on the game.
                    </p>
                </div>

                {/* Core Features Grid */}
                <div className="grid md:grid-cols-3 gap-8">
                    <FeatureCard
                        icon={<Users className="w-8 h-8 text-indigo-400" />}
                        title="Quorum Logic"
                        description="Set a minimum player count (e.g., 'Need 4 for Commander'). We automatically highlight dates that hit this threshold."
                    />
                    <FeatureCard
                        icon={<Trophy className="w-8 h-8 text-amber-400" />}
                        title="Waitlists & Capacity"
                        description="Limited table space? set a Max Player limit. We manage a first-come-first-serve waitlist that auto-promotes players if a spot opens up."
                    />
                    <FeatureCard
                        icon={<Bot className="w-8 h-8 text-cyan-400" />}
                        title="Chat Integration"
                        description="Don't leave the group chat. Our Telegram & Discord bots assist with voting, reminders, and managing the event directly from your DM."
                    />
                </div>

                {/* The Comparison Matrix */}
                <div className="bg-slate-900/50 rounded-3xl border border-slate-800 p-6 md:p-8 overflow-hidden">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-white mb-4">Why Switch?</h2>
                        <p className="text-slate-400">See how we stack up against the general-purpose tools — including Doodle.</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead>
                                <tr className="border-b border-slate-700 text-slate-400 text-sm">
                                    <th className="py-4 pl-4 font-normal w-1/5">Feature</th>
                                    <th className="py-4 px-2 font-bold text-indigo-400 text-lg bg-indigo-500/10 rounded-t-lg">Tabletop Time</th>
                                    <th className="py-4 px-2 font-normal">Doodle</th>
                                    <th className="py-4 px-2 font-normal">When2meet</th>
                                    <th className="py-4 px-2 font-normal">Calendly</th>
                                    <th className="py-4 px-2 font-normal">Calendar Apps</th>
                                    <th className="py-4 px-2 font-normal">Group Chats</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 text-slate-300 text-sm md:text-base">
                                <Row label="No Sign-Up Needed" checkTT={true} checkDoodle={false} checkW2M={true} checkCal={false} checkApps={false} checkChat={false} />
                                <Row label="No Ads" checkTT={true} checkDoodle={false} checkW2M={false} checkCal={false} checkApps={false} checkChat={false} />
                                <Row label="Quorum (Min Players)" checkTT={true} checkDoodle={false} checkW2M={false} checkCal={false} checkApps={false} checkChat={false} />
                                <Row label="Waitlist & Capacity" checkTT={true} checkDoodle={false} checkW2M={false} checkCal={false} checkApps={false} checkChat={false} />
                                <Row label="Optional Chatbots" checkTT={true} checkDoodle={false} checkW2M={false} checkCal={false} checkApps={false} checkChat={true} noteChat="Native Polls" />
                                <Row label="Works for Large Groups" checkTT={true} checkDoodle={true} checkW2M={true} checkCal={false} checkApps={false} checkChat={true} />
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-4 text-center text-xs text-slate-500">
                        * Comparison based on standard &quot;Free&quot; tiers of respective services.
                        <br />
                        * &quot;Group Chats&quot; refers to Signal, WhatsApp, Discord, etc.
                    </div>
                </div>

                {/* Calendar Section */}
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-2 text-emerald-400 font-mono text-sm uppercase tracking-widest">
                            <Calendar className="w-5 h-5" />
                            <span>It&apos;s not real until it&apos;s on the calendar</span>
                        </div>
                        <h2 className="text-3xl font-bold text-white">One-Click Finalization</h2>
                        <p className="text-slate-400 text-lg leading-relaxed">
                            Once you pick a date, we generate native <strong>Google Calendar</strong> links and standard <strong>.ICS</strong> files for Apple/Outlook. No more &quot;I forgot&quot; excuses.
                        </p>
                    </div>
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-2xl border border-slate-700 flex flex-col gap-4 text-center">
                        <div className="p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20 cursor-default transition-all">
                            Add to Google Calendar
                        </div>
                        <div className="p-4 bg-slate-700 text-slate-300 rounded-lg font-bold cursor-default opacity-75">
                            Download .ICS File
                        </div>
                    </div>
                </div>


                <div className="text-center pt-12 border-t border-slate-800">
                    <Link href="/new" className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] hover:shadow-[0_0_60px_-10px_rgba(79,70,229,0.6)] hover:scale-105 text-lg">
                        Start Your First Event &rarr;
                    </Link>
                </div>

            </div>
        </main>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition-colors group">
            <div className="mb-4 p-3 bg-slate-950 rounded-xl inline-block group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-slate-200 mb-2">{title}</h3>
            <p className="text-slate-400 leading-relaxed">{description}</p>
        </div>
    );
}

function Row({ label, checkTT, checkDoodle, checkW2M, checkCal, checkApps, checkChat, noteChat, good = true }: any) {
    return (
        <tr className="hover:bg-slate-800/20 transition-colors">
            <td className="py-4 pl-4 font-medium">{label}</td>
            <td className="py-4 px-2 bg-indigo-500/5 font-bold text-indigo-300">
                {checkTT === good ? <Check className="w-5 h-5 text-emerald-400 inline" /> : <X className="w-5 h-5 text-rose-500 inline" />}
            </td>
            <td className="py-4 px-2">
                {checkDoodle === good ? <Check className="w-5 h-5 text-emerald-400 inline" /> : <X className="w-5 h-5 text-rose-500 inline" />}
            </td>
            <td className="py-4 px-2">
                {checkW2M === good ? <Check className="w-5 h-5 text-emerald-400 inline" /> : <X className="w-5 h-5 text-rose-500 inline" />}
            </td>
            <td className="py-4 px-2">
                {checkCal === good ? <Check className="w-5 h-5 text-emerald-400 inline" /> : <X className="w-5 h-5 text-rose-500 inline" />}
            </td>
            <td className="py-4 px-2">
                {checkApps === good ? <Check className="w-5 h-5 text-emerald-400 inline" /> : <X className="w-5 h-5 text-rose-500 inline" />}
            </td>
            <td className="py-4 px-2">
                {checkChat === good ? <Check className="w-5 h-5 text-emerald-400 inline" /> : (
                    noteChat ? <span className="text-xs text-amber-400">{noteChat}</span> : <X className="w-5 h-5 text-rose-500 inline" />
                )}
            </td>
        </tr>
    );
}

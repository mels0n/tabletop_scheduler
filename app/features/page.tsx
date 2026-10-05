import { Users, Trophy, Calendar, CalendarDays, Bot, Check, X } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SchemaGenerator } from '@/shared/lib/aeo';

export const metadata: Metadata = {
    title: 'Features: Game Night Scheduling Built for Tabletop Groups',
    description: 'The Doodle replacement built for gaming groups. Quorum logic, waitlists, Telegram & Discord bots, and no sign-up required for anyone. Free forever.',
    alternates: {
        canonical: '/features',
    },
};

const schema = [
    SchemaGenerator.softwareApp({
        name: 'Tabletop Time',
        description: 'A free, no-sign-up game night scheduler for tabletop gaming groups. Doodle alternative with quorum logic, waitlists, and native Telegram & Discord bot integration.',
        applicationCategory: 'UtilitiesApplication',
        alternateName: 'Tabletop Scheduler',
        featureList: [
            'No sign-up required for organizers or participants',
            'Quorum logic: automatically highlights dates that meet minimum player count',
            'Waitlists and player capacity limits',
            'Telegram bot integration: live availability in group chat',
            'Discord bot integration: scheduling inside your server',
            'One-click Google Calendar and ICS event export',
            'Zero ads, zero tracking, open source',
        ],
    }),
    SchemaGenerator.faq([
        {
            question: 'Is Tabletop Time a Doodle replacement for game nights?',
            answer: 'Yes. Tabletop Time replaces Doodle for gaming groups with features Doodle does not have: no sign-up required for anyone, quorum logic for minimum player counts, waitlists, and native Telegram and Discord bot integration, all completely free with no ads.',
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
        <main className="min-h-screen bg-ink text-parchment p-6 md:p-12">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />
            <div className="max-w-7xl mx-auto space-y-24">

                {/* Hero */}
                <div className="text-center space-y-6 max-w-3xl mx-auto">
                    <h1 className="text-4xl md:text-6xl font-bold font-display text-parchment">
                        More Than Just &quot;Finding a Time&quot;
                    </h1>
                    <p className="text-xl text-mist leading-relaxed">
                        Generic scheduling tools leave you to do the heavy lifting when someone cancels.
                        We handle the <strong>Game Night Logistics</strong> so you can focus on the game.
                    </p>
                </div>

                {/* Core Features Grid */}
                <div className="grid md:grid-cols-3 gap-8">
                    <FeatureCard
                        icon={<Users className="w-5 h-5" />}
                        title="Quorum Logic"
                        description="Set a minimum player count (e.g., 'Need 4 for Commander'). We automatically highlight dates that hit this threshold."
                    />
                    <FeatureCard
                        icon={<Trophy className="w-5 h-5" />}
                        title="Waitlists & Capacity"
                        description="Limited table space? set a Max Player limit. We manage a first-come-first-serve waitlist that auto-promotes players if a spot opens up."
                    />
                    <FeatureCard
                        icon={<Bot className="w-5 h-5" />}
                        title="Chat Integration"
                        description="Don't leave the group chat. Our Telegram & Discord bots pin a live vote tally in your group, post reminders and the final result, and DM you login links and results."
                    />
                    <FeatureCard
                        icon={<CalendarDays className="w-5 h-5" />}
                        title="Campaign / Multi-Session Scheduling"
                        description="Running a D&D campaign, Legacy series, or recurring game night? Campaign mode groups candidate dates by shared player availability so you can see at a glance which run of sessions works for your whole table. Click the group that fits, tick the dates you want, and confirm, all inline with no extra steps. Per-session Google, Outlook, and .ics calendar buttons are generated automatically."
                    />
                </div>

                {/* The Comparison Matrix */}
                <div className="bg-surface rounded-card border border-line p-6 md:p-8">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-parchment mb-4">Why Switch?</h2>
                        <p className="text-mist">See how we stack up against the general-purpose tools, including Doodle.</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[1100px]">
                            <thead>
                                <tr className="border-b border-line bg-surface text-mist text-sm">
                                    <th className="py-4 pl-4 font-normal w-1/5">Feature</th>
                                    <th className="py-4 px-2 font-bold text-gold-bright text-lg bg-surface-2 ">Tabletop Time</th>
                                    <th className="py-4 px-2 font-normal"><Link href="/vs/doodle" className="hover:text-parchment transition-colors">Doodle</Link></th>
                                    <th className="py-4 px-2 font-normal"><Link href="/vs/when2meet" className="hover:text-parchment transition-colors">When2Meet</Link></th>
                                    <th className="py-4 px-2 font-normal"><Link href="/vs/lettucemeet" className="hover:text-parchment transition-colors">LettuceMeet</Link></th>
                                    <th className="py-4 px-2 font-normal"><Link href="/vs/rallly" className="hover:text-parchment transition-colors">Rallly</Link></th>
                                    <th className="py-4 px-2 font-normal">Calendar Apps</th>
                                    <th className="py-4 px-2 font-normal">Group Chats</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line text-parchment-2 text-sm md:text-base">
                                <Row label="No Sign-Up Needed" checkTT={true} checkDoodle={false} checkW2M={true} checkLM={false} checkRallly="Optional" checkApps={false} checkChat={false} />
                                <Row label="No Ads" checkTT={true} checkDoodle={false} checkW2M={false} checkLM={true} checkRallly={true} checkApps={false} checkChat={false} />
                                <Row label="Quorum (Min Players)" checkTT={true} checkDoodle={false} checkW2M={false} checkLM={false} checkRallly={false} checkApps={false} checkChat={false} />
                                <Row label="Waitlist & Capacity" checkTT={true} checkDoodle={false} checkW2M={false} checkLM={false} checkRallly={false} checkApps={false} checkChat={false} />
                                <Row label="Discord / Telegram Bots" checkTT={true} checkDoodle={false} checkW2M={false} checkLM={false} checkRallly={false} checkApps={false} checkChat={true} noteChat="Native Polls" />
                                <Row label="Works for Large Groups" checkTT={true} checkDoodle={true} checkW2M={true} checkLM={true} checkRallly={true} checkApps={false} checkChat={true} />
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-4 text-center text-xs text-mist">
                        * Comparison based on standard free tiers as of 2026.
                        <br />
                        * &quot;Group Chats&quot; refers to Signal, WhatsApp, Discord, etc. LettuceMeet requires Google login to create events.
                    </div>
                </div>

                {/* Calendar Section */}
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-2 text-gold-bright font-semibold text-sm uppercase tracking-[0.12em]">
                            <Calendar className="w-5 h-5" aria-hidden="true" />
                            <span>It&apos;s not real until it&apos;s on the calendar</span>
                        </div>
                        <h2 className="text-3xl font-bold text-parchment">One-Click Finalization</h2>
                        <p className="text-mist text-lg leading-relaxed">
                            Once you pick a date, we generate native <strong>Google Calendar</strong> links and standard <strong>.ICS</strong> files for Apple/Outlook. No more &quot;I forgot&quot; excuses.
                        </p>
                    </div>
                    <div className="bg-surface p-8 rounded-card border border-line flex flex-col gap-4 text-center">
                        <div className="p-4 bg-gold text-on-gold rounded-control font-bold cursor-default">
                            Add to Google Calendar
                        </div>
                        <div className="p-4 bg-surface-2 text-parchment-2 rounded-control font-bold cursor-default">
                            Download .ICS File
                        </div>
                    </div>
                </div>


                <div className="text-center pt-12 space-y-8">
                    <div className="ornament" aria-hidden="true">✦</div>
                    <Link href="/new" className="btn-primary px-8 py-4 text-lg">
                        Start Your First Event &rarr;
                    </Link>
                </div>

            </div>
        </main>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="card-accent">
            <div className="icon-tile mb-4" aria-hidden="true">
                {icon}
            </div>
            <h3 className="font-display text-xl font-bold text-parchment mb-2">{title}</h3>
            <p className="text-parchment-2 leading-relaxed">{description}</p>
        </div>
    );
}

function Cell({ value, note, good = true }: { value: boolean | string; note?: string; good?: boolean }) {
    if (typeof value === 'string') return <span className="text-xs text-maybe">{value}</span>;
    return value === good
        ? <Check className="w-5 h-5 text-yes inline" />
        : note
            ? <span className="text-xs text-maybe">{note}</span>
            : <X className="w-5 h-5 text-no inline" />;
}

function Row({ label, checkTT, checkDoodle, checkW2M, checkLM, checkRallly, checkApps, checkChat, noteChat }: {
    label: string;
    checkTT: boolean | string;
    checkDoodle: boolean | string;
    checkW2M: boolean | string;
    checkLM: boolean | string;
    checkRallly: boolean | string;
    checkApps: boolean | string;
    checkChat: boolean | string;
    noteChat?: string;
}) {
    return (
        <tr className="hover:bg-surface-2 transition-colors">
            <td className="py-4 pl-4 font-medium">{label}</td>
            <td className="py-4 px-2 bg-surface-2 font-bold text-gold-bright">
                <Cell value={checkTT} />
            </td>
            <td className="py-4 px-2"><Cell value={checkDoodle} /></td>
            <td className="py-4 px-2"><Cell value={checkW2M} /></td>
            <td className="py-4 px-2"><Cell value={checkLM} /></td>
            <td className="py-4 px-2"><Cell value={checkRallly} /></td>
            <td className="py-4 px-2"><Cell value={checkApps} /></td>
            <td className="py-4 px-2"><Cell value={checkChat} note={noteChat} /></td>
        </tr>
    );
}

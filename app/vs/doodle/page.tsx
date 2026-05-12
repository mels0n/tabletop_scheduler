import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, X, ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import { SchemaGenerator } from '@/shared/lib/aeo';

export const metadata: Metadata = {
    title: 'Doodle Alternative for Game Night',
    description: 'Tabletop Time vs Doodle: no ads, no sign-up, quorum logic for minimum player counts, and Discord & Telegram built in. Free forever.',
    alternates: {
        canonical: '/vs/doodle',
    },
};

const schema = [
    SchemaGenerator.softwareApp({
        name: 'Tabletop Time',
        description: 'A free, no-sign-up game night scheduler built for tabletop gaming groups. The Doodle alternative with quorum logic, waitlists, and native Discord & Telegram integration.',
        applicationCategory: 'UtilitiesApplication',
        alternateName: 'Tabletop Scheduler',
        featureList: [
            'No sign-up required for organizers or participants',
            'No ads — ever',
            'Quorum logic — minimum player threshold before a date is considered viable',
            'Waitlists with automatic promotion when spots open',
            'Discord and Telegram bot integration',
            'Campaign mode for multi-session scheduling',
            'One-click Google Calendar and .ICS export',
        ],
    }),
    SchemaGenerator.faq([
        {
            question: 'Is Tabletop Time a free Doodle alternative?',
            answer: 'Yes. Tabletop Time is completely free with no ads and no subscriptions. Unlike Doodle\'s free tier, which shows ads and limits features, Tabletop Time is free for everything — unlimited events, unlimited players, Discord and Telegram bots included.',
        },
        {
            question: 'Does Tabletop Time require a sign-up like Doodle?',
            answer: 'No. Neither organizers nor participants need an account. You create an event in under a minute, share the link, and players vote without logging in. Your manager access is stored locally in your browser.',
        },
        {
            question: 'What does Tabletop Time have that Doodle does not?',
            answer: 'Quorum logic (minimum player thresholds), player capacity limits, first-come-first-serve waitlists, native Discord and Telegram bot integration, campaign mode for multi-session series, and zero ads on any plan.',
        },
        {
            question: 'How do I switch from Doodle to Tabletop Time?',
            answer: 'Create a new event at tabletoptime.us/new — no account required. Add your candidate dates, set a quorum if you want one, and share the link. Takes about two minutes.',
        },
    ]),
];

const rows: { label: string; tt: boolean; doodle: boolean | string; note?: string }[] = [
    { label: 'Free to use', tt: true, doodle: 'Limited' },
    { label: 'No ads', tt: true, doodle: false },
    { label: 'No sign-up for organizers', tt: true, doodle: false },
    { label: 'No sign-up for participants', tt: true, doodle: true },
    { label: 'Quorum / minimum players', tt: true, doodle: false },
    { label: 'Waitlists & player capacity', tt: true, doodle: false },
    { label: 'Discord integration', tt: true, doodle: false },
    { label: 'Telegram integration', tt: true, doodle: false },
    { label: 'Campaign / multi-session mode', tt: true, doodle: false },
    { label: 'Calendar export (.ICS / Google)', tt: true, doodle: true },
    { label: 'Open source', tt: true, doodle: false },
];

export default function VsDoodlePage() {
    const isHosted = process.env.NEXT_PUBLIC_IS_HOSTED === 'true';
    if (!isHosted) notFound();

    return (
        <main className="min-h-screen bg-slate-950 text-slate-50 py-20 px-6">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />

            <div className="max-w-4xl mx-auto space-y-20">

                {/* Hero */}
                <div className="space-y-6">
                    <p className="text-indigo-400 font-mono text-sm uppercase tracking-widest">Doodle Alternative</p>
                    <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                        Tabletop Time vs Doodle
                        <span className="block text-slate-400 text-2xl md:text-3xl font-normal mt-2">
                            The scheduling tool that actually gets game night.
                        </span>
                    </h1>
                    <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">
                        Doodle is designed for scheduling business meetings — calendar polling, corporate SSO, and 20-participant polls with ad banners in between. It works. But for a six-person D&D group trying to nail down a Saturday night, it misses everything that actually matters.
                    </p>
                    <Link
                        href="/new"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 font-semibold transition-all"
                    >
                        Try It Free <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>

                {/* Why Doodle falls short */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-white">Why Doodle Frustrates Game Groups</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <Problem
                            title="Ads on every page"
                            body="Doodle's free tier is funded by display ads. Every vote page your players open shows ads. For a tool used once a week by a leisure group, that's a bad trade."
                        />
                        <Problem
                            title="Organizers must create an account"
                            body="Creating a Doodle poll requires signing up. Your DM just wants to send a link, not create another account with another password to lose."
                        />
                        <Problem
                            title="No minimum player logic"
                            body="Doodle tells you who's free when. It has no concept of 'we need at least 4 players or the session doesn't happen.' You have to count manually and decide yourself."
                        />
                        <Problem
                            title="No waitlists or capacity limits"
                            body="If your game is limited to 5 players at a table, Doodle can't help you manage overflow. It has no concept of a waitlist or a seat maximum."
                        />
                        <Problem
                            title="No Discord or Telegram integration"
                            body="Your group lives in Discord. Doodle lives outside it. Players forget to vote because the link gets buried. Tabletop Time's bot brings scheduling into the group chat."
                        />
                        <Problem
                            title="No campaign or recurring-session support"
                            body="Running a campaign means scheduling sessions in sequence. Doodle has no mode for finding the three best Saturdays in a row that work for the whole table."
                        />
                    </div>
                </section>

                {/* Comparison table */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-white">Feature Comparison</h2>
                    <div className="overflow-x-auto rounded-2xl border border-slate-800">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-800 text-left">
                                    <th className="py-4 pl-6 font-normal text-slate-400 w-1/2">Feature</th>
                                    <th className="py-4 px-4 font-bold text-indigo-400 bg-indigo-500/10">Tabletop Time</th>
                                    <th className="py-4 px-4 font-normal text-slate-400">Doodle (free)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {rows.map(({ label, tt, doodle, note }) => (
                                    <tr key={label} className="hover:bg-slate-900/40 transition-colors">
                                        <td className="py-3 pl-6 text-slate-300">{label}</td>
                                        <td className="py-3 px-4 bg-indigo-500/5">
                                            {tt ? <Check className="w-5 h-5 text-green-400" /> : <X className="w-5 h-5 text-red-400" />}
                                        </td>
                                        <td className="py-3 px-4">
                                            {typeof doodle === 'string' ? (
                                                <span className="text-yellow-400 text-xs font-mono">{doodle}</span>
                                            ) : doodle ? (
                                                <Check className="w-5 h-5 text-green-400" />
                                            ) : (
                                                <X className="w-5 h-5 text-red-400" />
                                            )}
                                            {note && <span className="ml-2 text-xs text-slate-500">{note}</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-slate-500">Comparison based on Doodle free tier as of 2026.</p>
                </section>

                {/* The quorum difference */}
                <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 space-y-4">
                    <h2 className="text-2xl font-bold text-white">The Feature Doodle Will Never Build</h2>
                    <p className="text-slate-400 leading-relaxed">
                        Quorum logic is the single most game-night-specific feature a scheduler can have. It answers the question Doodle can't: <em>"Is this date viable?"</em> — not just "who's free," but "do we have enough players to actually play?"
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                        Set a minimum player count (e.g., need at least 4 for a Commander pod). Tabletop Time highlights in green the dates that hit that threshold. Dates below it are shown in amber. You see the viable windows at a glance without counting cells in a spreadsheet.
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                        Doodle is built for business scheduling where any 1-on-1 meeting is viable. Game groups need group-viability logic. Tabletop Time is the only free tool that has it.
                    </p>
                </section>

                {/* Migration CTA */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-white">Switching Takes Two Minutes</h2>
                    <p className="text-slate-400 leading-relaxed">
                        There's no migration path because there's nothing to migrate. You don't have an account to transfer. Just go to <Link href="/new" className="text-indigo-400 hover:text-indigo-300 underline">tabletoptime.us/new</Link>, give your event a name, add some candidate dates, set a quorum if you want one, and share the link. Your players click, vote, and you're done.
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                        No account for you. No account for them. No ads on the vote page they see. Works on any device with a browser.
                    </p>
                    <div className="flex flex-wrap gap-4">
                        <Link
                            href="/new"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 font-semibold transition-all"
                        >
                            Create Your First Event <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/how-it-works"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-slate-700 hover:border-indigo-500/50 text-slate-300 hover:text-white transition-all"
                        >
                            See How It Works
                        </Link>
                    </div>
                </section>

                {/* FAQ */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-white">Frequently Asked Questions</h2>
                    <div className="space-y-4">
                        <Faq q="Is Tabletop Time really free?" a="Yes — no ads, no paywalls, no subscriptions. It's an open-source passion project. You can also self-host it if you want full control." />
                        <Faq q="Does it work for non-D&D game nights?" a="Absolutely. Quorum logic, waitlists, and calendar export work for any group activity: MTG Commander pods, board game nights, sports leagues, movie clubs — anything where you need a minimum number of people to make it worth doing." />
                        <Faq q="What if a player doesn't have Discord or Telegram?" a="The Discord and Telegram bots are optional. The voting link works in any app — just paste it in a group chat, text, or email. Players click, vote, done." />
                        <Faq q="Can I edit the event after sharing the link?" a="Yes. The event creator gets a manager token stored locally that lets them edit dates, change the quorum, add slots, or finalize at any time." />
                    </div>
                </section>

                <div className="border-t border-slate-800 pt-8 flex flex-wrap gap-6 text-sm text-slate-500">
                    <Link href="/features" className="hover:text-indigo-400 transition-colors">Full Feature List</Link>
                    <Link href="/vs/when2meet" className="hover:text-indigo-400 transition-colors">vs When2Meet</Link>
                    <Link href="/pricing" className="hover:text-indigo-400 transition-colors">Pricing (Free)</Link>
                    <Link href="/new" className="hover:text-indigo-400 transition-colors">Create an Event</Link>
                </div>
            </div>
        </main>
    );
}

function Problem({ title, body }: { title: string; body: string }) {
    return (
        <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
            <div className="flex items-start gap-2">
                <X className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <h3 className="font-semibold text-slate-200">{title}</h3>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed pl-6">{body}</p>
        </div>
    );
}

function Faq({ q, a }: { q: string; a: string }) {
    return (
        <div className="border border-slate-800 rounded-xl p-5 space-y-2">
            <p className="font-semibold text-slate-200">{q}</p>
            <p className="text-slate-400 text-sm leading-relaxed">{a}</p>
        </div>
    );
}

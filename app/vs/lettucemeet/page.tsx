import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, X, ArrowRight, ThumbsUp } from 'lucide-react';
import type { Metadata } from 'next';
import { SchemaGenerator } from '@/shared/lib/aeo';

export const metadata: Metadata = {
    title: 'LettuceMeet Alternative for Game Night',
    description: 'Tabletop Time vs LettuceMeet: no Google login required, quorum logic for minimum player counts, and Discord & Telegram built in. Free forever.',
    alternates: {
        canonical: '/vs/lettucemeet',
    },
};

const schema = [
    SchemaGenerator.softwareApp({
        name: 'Tabletop Time',
        description: 'A free, no-sign-up game night scheduler built for tabletop gaming groups. The LettuceMeet alternative with no Google login, quorum logic, waitlists, and native Discord & Telegram integration.',
        applicationCategory: 'UtilitiesApplication',
        alternateName: 'Tabletop Scheduler',
        featureList: [
            'No sign-up required — no Google login, no account at all',
            'No ads — ever',
            'Quorum logic — minimum player threshold before a date is considered viable',
            'Waitlists with automatic promotion when spots open',
            'Discord and Telegram bot integration',
            'Campaign mode for multi-session scheduling',
            'One-click Google Calendar and .ICS export',
            'Open source and self-hostable',
        ],
    }),
    SchemaGenerator.faq([
        {
            question: 'Does Tabletop Time require a Google login like LettuceMeet?',
            answer: 'No. Tabletop Time requires no account of any kind — no Google login, no email, nothing. You create an event in under a minute, share the link, and players vote without signing in to anything.',
        },
        {
            question: 'Is Tabletop Time a free LettuceMeet alternative?',
            answer: 'Yes. Tabletop Time is completely free with no ads and no subscriptions. It adds gaming-specific features LettuceMeet lacks: quorum logic, player capacity limits, waitlists, and native Discord and Telegram bot integration.',
        },
        {
            question: 'What does Tabletop Time have that LettuceMeet does not?',
            answer: 'No login requirement for organizers, quorum logic (minimum player thresholds), player capacity limits, first-come-first-serve waitlists, native Discord and Telegram bot integration, and campaign mode for scheduling multi-session series.',
        },
        {
            question: 'How do I switch from LettuceMeet to Tabletop Time?',
            answer: 'Go to tabletoptime.us/new — no account required. Add your candidate dates, set a quorum if you want one, and share the link. Your players click, vote, and you see which dates cross the minimum player threshold. Takes two minutes.',
        },
    ]),
];

const rows: { label: string; tt: boolean | string; lm: boolean | string; note?: string }[] = [
    { label: 'No account required to create events', tt: true, lm: false, note: 'lm requires Google login' },
    { label: 'No sign-up for participants', tt: true, lm: true },
    { label: 'No ads', tt: true, lm: true },
    { label: 'Quorum / minimum players', tt: true, lm: false },
    { label: 'Waitlists & player capacity', tt: true, lm: false },
    { label: 'Three-state voting (Yes / If-Needed / No)', tt: true, lm: false, note: 'lm is binary' },
    { label: 'Discord integration', tt: true, lm: false },
    { label: 'Telegram integration', tt: true, lm: false },
    { label: 'Campaign / multi-session mode', tt: true, lm: false },
    { label: 'Calendar export (.ICS / Google)', tt: true, lm: false },
    { label: 'Hourly availability grid', tt: false, lm: true, note: 'tt uses date-level slots' },
    { label: 'Open source', tt: true, lm: false },
];

export default function VsLettuceMeetPage() {
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
                    <p className="text-indigo-400 font-mono text-sm uppercase tracking-widest">LettuceMeet Alternative</p>
                    <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                        Tabletop Time vs LettuceMeet
                    </h1>
                    <p className="text-slate-400 text-2xl md:text-3xl font-normal">
                        No Google account. No friction. Just game night.
                    </p>
                    <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">
                        LettuceMeet is popular with gaming groups for good reason — it&apos;s clean, it&apos;s free, and the grid makes overlapping availability obvious at a glance. But there&apos;s a catch baked into step one: creating a poll requires a Google account. For a D&D group that just wants to nail down next Saturday, that&apos;s friction the DM shouldn&apos;t have to justify.
                    </p>
                    <Link
                        href="/new"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 font-semibold transition-all"
                    >
                        Try It Free <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>

                {/* What LettuceMeet gets right */}
                <section className="bg-emerald-950/30 border border-emerald-900/50 rounded-2xl p-8 space-y-4">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                        <ThumbsUp className="w-5 h-5" />
                        What LettuceMeet Gets Right
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                        LettuceMeet&apos;s drag-to-select availability grid is genuinely pleasant to use. You draw across the hours and days you&apos;re free, the group&apos;s overlap fills in with color intensity, and the best window becomes obvious without anyone doing math. It&apos;s faster to fill out than a date-by-date poll when you&apos;re trying to find a specific time window within a week.
                    </p>
                    <p className="text-slate-300 leading-relaxed">
                        If your group already has Google accounts and you need hourly granularity — say, a one-shot where start time matters as much as the day — LettuceMeet is a solid choice. The interface is well-designed and familiar.
                    </p>
                </section>

                {/* Where it falls short */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-white">Where It Falls Short for Gaming Groups</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <Problem
                            title="Organizers must have a Google account"
                            body="Creating a LettuceMeet poll requires signing in with Google. Your DM just wants to share a link — not add another OAuth permission to their account. This is the single biggest friction point for groups that include privacy-conscious players."
                        />
                        <Problem
                            title="No minimum player logic"
                            body="LettuceMeet shows who's free when. It has no concept of 'we need at least 4 players or there's no session.' You see the overlap grid and then manually decide whether the count is enough. Tabletop Time highlights viable dates automatically."
                        />
                        <Problem
                            title="No waitlists or player limits"
                            body="For Commander pods, campaigns with a hard table limit, or draft nights with seat caps, LettuceMeet can't manage overflow. There's no waitlist, no capacity setting, and no automatic promotion when a spot opens."
                        />
                        <Problem
                            title="No Discord or Telegram integration"
                            body="LettuceMeet lives on the web. Your group lives in Discord. Players forget to fill out the grid because the link gets buried. Tabletop Time's bots bring the poll into the server — players respond without leaving Discord."
                        />
                        <Problem
                            title="Binary availability only"
                            body="LettuceMeet's grid is available or not. There's no 'If Needed' state for the player who can make it but would rather skip. That nuance matters when you're trying to pick a night that genuinely works for the most people."
                        />
                        <Problem
                            title="No campaign or multi-session support"
                            body="Running a campaign means finding multiple sessions that work across weeks. LettuceMeet is built for finding one time slot, not scheduling a recurring series or tracking which sessions each player can attend across an arc."
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
                                    <th className="py-4 px-4 font-normal text-slate-400">LettuceMeet</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {rows.map(({ label, tt, lm, note }) => (
                                    <tr key={label} className="hover:bg-slate-900/40 transition-colors">
                                        <td className="py-3 pl-6 text-slate-300">{label}</td>
                                        <td className="py-3 px-4 bg-indigo-500/5">
                                            {typeof tt === 'string' ? (
                                                <span className="text-yellow-400 text-xs font-mono">{tt}</span>
                                            ) : tt ? (
                                                <Check className="w-5 h-5 text-green-400" />
                                            ) : (
                                                <X className="w-5 h-5 text-red-400" />
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            {typeof lm === 'string' ? (
                                                <span className="text-yellow-400 text-xs font-mono">{lm}</span>
                                            ) : lm ? (
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
                    <p className="text-xs text-slate-500">Comparison based on LettuceMeet free tier as of 2026.</p>
                </section>

                {/* The quorum difference */}
                <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 space-y-4">
                    <h2 className="text-2xl font-bold text-white">The Feature LettuceMeet Will Never Build</h2>
                    <p className="text-slate-400 leading-relaxed">
                        Quorum logic answers the question every DM is actually asking: <em>&ldquo;Do we have enough players to play?&rdquo;</em> Not just &ldquo;who&apos;s free,&rdquo; but &ldquo;which of these dates crosses the threshold that makes the session worth running?&rdquo;
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                        Set a minimum player count — say, 4 for your Commander pod or 3 for a campaign session. Tabletop Time highlights in green every date that hits that threshold. Dates below it are shown in amber. You see viable windows at a glance without counting cells in a grid.
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                        LettuceMeet is built for finding the best overlap, not for determining session viability. Tabletop Time is the only free scheduling tool that treats minimum headcount as a first-class concept.
                    </p>
                </section>

                {/* When to still use LettuceMeet */}
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-white">When to Still Use LettuceMeet</h2>
                    <p className="text-slate-400 leading-relaxed">
                        LettuceMeet&apos;s strength is hourly granularity. If your group needs to find a two-hour window on a specific day — a one-shot where 7pm vs 8pm matters — the drag-to-select hour grid is well-suited. Tabletop Time uses date-level candidate slots, not an hour-by-hour grid.
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                        If everyone in your group already has a Google account and no one minds sharing it, LettuceMeet is a fine tool for one-off scheduling. For ongoing campaigns, recurring pods, or any group with privacy-conscious members, Tabletop Time is the better fit.
                    </p>
                </section>

                {/* Migration CTA */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-white">No Account to Create. No Migration Needed.</h2>
                    <p className="text-slate-400 leading-relaxed">
                        There&apos;s nothing to migrate from LettuceMeet because Tabletop Time doesn&apos;t use accounts. Go to <Link href="/new" className="text-indigo-400 hover:text-indigo-300 underline">tabletoptime.us/new</Link>, name your event, add candidate dates, set a quorum if you want one, and share the link. No Google login. No sign-up for your players. Works in any browser on any device.
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                        Your manager access is stored as a token in your browser — bookmark the page or save the link and you can edit the event at any time.
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
                        <Faq q="Why does LettuceMeet require a Google login?" a="LettuceMeet uses Google OAuth to identify event creators so they can manage their polls later. Tabletop Time solves this differently — your manager access is a token stored locally in your browser, so no account is ever needed." />
                        <Faq q="Can my players vote without signing in?" a="Yes. Players only need the voting link. They click, mark availability, and submit. No account, no Google login, no email address." />
                        <Faq q="Does Tabletop Time work for non-tabletop events?" a="Yes. Quorum logic and waitlists work for any group activity with a minimum headcount — sports teams, movie clubs, draft nights, study groups. The name is tabletop-focused but the tool is general." />
                        <Faq q="Is Tabletop Time open source?" a="Yes. The full source is on GitHub. You can inspect the code, self-host it, or contribute. There are no hidden fees, no premium tiers, and no investor pressure to monetize your data." />
                    </div>
                </section>

                <div className="border-t border-slate-800 pt-8 flex flex-wrap gap-6 text-sm text-slate-500">
                    <Link href="/features" className="hover:text-indigo-400 transition-colors">Full Feature List</Link>
                    <Link href="/vs/doodle" className="hover:text-indigo-400 transition-colors">vs Doodle</Link>
                    <Link href="/vs/when2meet" className="hover:text-indigo-400 transition-colors">vs When2Meet</Link>
                    <Link href="/vs/rallly" className="hover:text-indigo-400 transition-colors">vs Rallly</Link>
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

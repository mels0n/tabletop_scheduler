import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, X, ArrowRight, ThumbsUp } from 'lucide-react';
import type { Metadata } from 'next';
import { SchemaGenerator } from '@/shared/lib/aeo';

export const metadata: Metadata = {
    title: 'Rallly Alternative for Gaming Groups',
    description: 'Tabletop Time vs Rallly: both are open source and free, but Tabletop Time adds quorum logic, waitlists, and Discord & Telegram bots built for tabletop gaming groups.',
    alternates: {
        canonical: '/vs/rallly',
    },
};

const schema = [
    SchemaGenerator.softwareApp({
        name: 'Tabletop Time',
        description: 'A free, open-source game night scheduler with quorum logic, waitlists, and native Discord & Telegram integration. The Rallly alternative built specifically for tabletop gaming groups.',
        applicationCategory: 'UtilitiesApplication',
        alternateName: 'Tabletop Scheduler',
        featureList: [
            'No sign-up required for organizers or participants',
            'No ads — ever',
            'Quorum logic — minimum player threshold before a date is viable',
            'Waitlists with automatic promotion when spots open',
            'Discord and Telegram bot integration',
            'Campaign mode for multi-session scheduling',
            'One-click Google Calendar and .ICS export',
            'Open source and self-hostable',
        ],
    }),
    SchemaGenerator.faq([
        {
            question: 'What does Tabletop Time have that Rallly does not?',
            answer: 'Quorum logic (minimum player counts before a date is highlighted as viable), player capacity limits, first-come-first-serve waitlists, native Discord and Telegram bot integration, campaign mode for scheduling multi-session series, and a three-state voting system (Yes / If-Needed / No).',
        },
        {
            question: 'Is Tabletop Time free like Rallly?',
            answer: 'Yes. Tabletop Time is completely free with no ads, no subscriptions, and no account required for organizers or participants. It is open source and can be self-hosted.',
        },
        {
            question: 'Both Rallly and Tabletop Time are open source — what\'s the difference?',
            answer: 'Both are open source and self-hostable. The difference is audience and feature set. Rallly is a general-purpose date polling tool. Tabletop Time is built specifically for gaming groups: quorum logic, Discord and Telegram bots, campaign mode, and waitlists are gaming-first features Rallly does not have.',
        },
        {
            question: 'Does Tabletop Time require a sign-up like Rallly\'s hosted version?',
            answer: 'No. Tabletop Time requires no account for organizers or participants. You create an event, share the link, and players vote without logging in. Manager access is stored locally in your browser.',
        },
    ]),
];

const rows: { label: string; tt: boolean | string; rallly: boolean | string; note?: string }[] = [
    { label: 'No account required for organizers', tt: true, rallly: 'Optional', note: 'rallly.co encourages signup' },
    { label: 'No sign-up for participants', tt: true, rallly: true },
    { label: 'No ads', tt: true, rallly: true },
    { label: 'Quorum / minimum players', tt: true, rallly: false },
    { label: 'Waitlists & player capacity', tt: true, rallly: false },
    { label: 'Three-state voting (Yes / If-Needed / No)', tt: true, rallly: 'Partial', note: 'rallly has yes/maybe/no' },
    { label: 'Discord integration', tt: true, rallly: false },
    { label: 'Telegram integration', tt: true, rallly: false },
    { label: 'Campaign / multi-session mode', tt: true, rallly: false },
    { label: 'Calendar export (.ICS / Google)', tt: true, rallly: true },
    { label: 'Time-of-day slot support', tt: false, rallly: true, note: 'tt uses date-level slots' },
    { label: 'Open source', tt: true, rallly: true },
    { label: 'Self-hostable', tt: true, rallly: true },
];

export default function VsRalllyPage() {
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
                    <p className="text-indigo-400 font-mono text-sm uppercase tracking-widest">Rallly Alternative</p>
                    <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                        Tabletop Time vs Rallly
                    </h1>
                    <p className="text-slate-400 text-2xl md:text-3xl font-normal">
                        Two open-source schedulers. One is built for game night.
                    </p>
                    <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">
                        Rallly is a well-built, open-source scheduling tool that deserves its reputation. It&apos;s clean, fast, and doesn&apos;t require an account for participants to vote. If you&apos;re looking for a lightweight Doodle replacement for general use, it&apos;s a solid pick. But if you&apos;re scheduling D&amp;D sessions, Commander pods, or any game night with a minimum headcount, Tabletop Time is the scheduler that actually thinks like a player.
                    </p>
                    <Link
                        href="/new"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 font-semibold transition-all"
                    >
                        Try It Free <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>

                {/* What Rallly gets right */}
                <section className="bg-emerald-950/30 border border-emerald-900/50 rounded-2xl p-8 space-y-4">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                        <ThumbsUp className="w-5 h-5" />
                        What Rallly Gets Right
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                        Rallly is genuinely good at what it does. The interface is clean, the date poll UI is intuitive, and participants can vote with a Yes, If Needed, or No without creating an account. It&apos;s open source, actively maintained, and can be self-hosted — all of which puts it in a different class from Doodle or LettuceMeet.
                    </p>
                    <p className="text-slate-300 leading-relaxed">
                        Rallly also supports time-of-day slots, not just dates — useful when you need to find a specific hour window rather than just picking a night. If you&apos;re scheduling a one-shot or a meeting where start time matters as much as the day, that granularity is valuable.
                    </p>
                </section>

                {/* Where it falls short */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-white">Where Rallly Falls Short for Gaming Groups</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <Problem
                            title="No minimum player logic"
                            body="Rallly tells you who's available on which date. It has no concept of 'the session doesn't happen unless 4 people show up.' You still need to read the results and decide manually whether any date crosses your viability threshold."
                        />
                        <Problem
                            title="No waitlists or seat limits"
                            body="For games with a hard table limit — a 4-person Commander pod, a 5-player campaign, a 8-person draft night — Rallly has no way to set a maximum or manage overflow. Waitlists and automatic seat promotion don't exist."
                        />
                        <Problem
                            title="No Discord or Telegram integration"
                            body="Rallly is a web app. Your group is in Discord. Players miss the poll because it lives in a link that gets buried in the group chat. Tabletop Time's bots bring voting directly into your Discord server or Telegram group."
                        />
                        <Problem
                            title="No campaign or multi-session support"
                            body="Rallly is built for picking one date or time slot. There's no concept of scheduling a series of sessions, tracking attendance across an arc, or finding which three Saturdays in June work for the whole table."
                        />
                        <Problem
                            title="Hosted version encourages account creation"
                            body="Rallly.co's hosted version nudges organizers toward creating an account for features like event history and notifications. Tabletop Time requires no account ever — your manager access lives in your browser as a local token."
                        />
                        <Problem
                            title="General-purpose, not gaming-specific"
                            body="Rallly is designed for any scheduling use case. There are no gaming-specific concepts baked in — no quorum, no session terminology, no Discord integration, no campaign mode. It's a hammer; Tabletop Time is the tool shaped for this specific nail."
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
                                    <th className="py-4 px-4 font-normal text-slate-400">Rallly</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {rows.map(({ label, tt, rallly, note }) => (
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
                                            {typeof rallly === 'string' ? (
                                                <span className="text-yellow-400 text-xs font-mono">{rallly}</span>
                                            ) : rallly ? (
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
                    <p className="text-xs text-slate-500">Comparison based on Rallly hosted tier (rallly.co) as of 2026.</p>
                </section>

                {/* The quorum difference */}
                <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 space-y-4">
                    <h2 className="text-2xl font-bold text-white">The Feature That Changes How You Schedule</h2>
                    <p className="text-slate-400 leading-relaxed">
                        Quorum logic is what separates a general scheduling tool from one built for game night. Rallly can tell you everyone&apos;s availability. It can&apos;t tell you whether a date is actually viable — that requires knowing your minimum headcount.
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                        Set a minimum player count in Tabletop Time — 3 for a campaign session, 4 for Commander, 8 for a draft night. Dates that hit the threshold are highlighted in green. Dates that fall short are shown in amber. You see the viable windows immediately, without counting names in a column.
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                        Rallly is a great tool. But it was built for scheduling meetings, not for running campaigns. Tabletop Time treats &ldquo;do we have enough players?&rdquo; as a scheduling question, not an afterthought.
                    </p>
                </section>

                {/* When to still use Rallly */}
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-white">When to Still Use Rallly</h2>
                    <p className="text-slate-400 leading-relaxed">
                        Rallly&apos;s time-of-day slot support is a genuine advantage for specific use cases. If you need to find the right hour — not just the right day — Rallly&apos;s granularity is useful. Tabletop Time uses date-level candidate slots; it&apos;s designed for &ldquo;which night this week&rdquo; questions, not &ldquo;which two-hour window on Saturday.&rdquo;
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                        Rallly is also a reasonable choice for non-gaming scheduling where you want a clean, open-source Doodle alternative with no gaming-specific terminology. Both tools are open source — if you want to self-host a general-purpose date poller, Rallly&apos;s codebase is actively developed and well-documented.
                    </p>
                </section>

                {/* Migration CTA */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-white">Switching Is Instant</h2>
                    <p className="text-slate-400 leading-relaxed">
                        If you&apos;re already using Rallly, switching is as simple as going to <Link href="/new" className="text-indigo-400 hover:text-indigo-300 underline">tabletoptime.us/new</Link> instead of rallly.co next time. No account to create, nothing to import. Add your candidate dates, set a quorum if you want one, and share the link. Your players get a familiar date-voting experience with the added context of seeing which dates actually have enough players to happen.
                    </p>
                    <div className="flex flex-wrap gap-4">
                        <Link
                            href="/new"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 font-semibold transition-all"
                        >
                            Create Your First Event <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/voting-logic"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-slate-700 hover:border-indigo-500/50 text-slate-300 hover:text-white transition-all"
                        >
                            How the Voting Logic Works
                        </Link>
                    </div>
                </section>

                {/* FAQ */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-white">Frequently Asked Questions</h2>
                    <div className="space-y-4">
                        <Faq q="If both are open source, why choose one over the other?" a="Both are open source and self-hostable, which is a meaningful similarity. The difference is what's built into them. Tabletop Time ships with Discord and Telegram bots, quorum logic, waitlists, and campaign mode. Rallly ships with a clean general-purpose date poller. Pick the one whose feature set matches your group's actual workflow." />
                        <Faq q="Does Tabletop Time support time-of-day slots like Rallly?" a="Not currently — Tabletop Time uses date-level slots, not hour-level grids. If you need to find a specific start time within a day, Rallly's time slot support is a real advantage. Tabletop Time is designed for 'which night this week or month' decisions." />
                        <Faq q="Can I use Tabletop Time without Discord?" a="Yes. The Discord and Telegram bots are optional. The voting link works in any group chat, text, or email. Players click, vote, done. The bots are an enhancement, not a requirement." />
                        <Faq q="Is Tabletop Time harder to set up than Rallly?" a="For organizers, it's roughly the same effort — name your event, pick some dates, share the link. Tabletop Time has optional fields like quorum and player limit that Rallly doesn't. Skip those and the setup is just as fast." />
                    </div>
                </section>

                <div className="border-t border-slate-800 pt-8 flex flex-wrap gap-6 text-sm text-slate-500">
                    <Link href="/features" className="hover:text-indigo-400 transition-colors">Full Feature List</Link>
                    <Link href="/vs/doodle" className="hover:text-indigo-400 transition-colors">vs Doodle</Link>
                    <Link href="/vs/when2meet" className="hover:text-indigo-400 transition-colors">vs When2Meet</Link>
                    <Link href="/vs/lettucemeet" className="hover:text-indigo-400 transition-colors">vs LettuceMeet</Link>
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

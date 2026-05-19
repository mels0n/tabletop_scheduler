import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, X, ArrowRight, ThumbsUp } from 'lucide-react';
import type { Metadata } from 'next';
import { SchemaGenerator } from '@/shared/lib/aeo';

export const metadata: Metadata = {
    title: 'When2Meet Alternative for Gaming Groups',
    description: 'Tabletop Time vs When2Meet: both are free and require no account, but Tabletop Time adds quorum logic, waitlists, and Discord & Telegram bots that gaming groups actually need.',
    alternates: {
        canonical: '/vs/when2meet',
    },
};

const schema = [
    SchemaGenerator.softwareApp({
        name: 'Tabletop Time',
        description: 'A free, no-sign-up game night scheduler with quorum logic, waitlists, and native Discord & Telegram integration. The When2Meet alternative built for tabletop gaming groups.',
        applicationCategory: 'UtilitiesApplication',
        alternateName: 'Tabletop Scheduler',
        featureList: [
            'No sign-up required for organizers or participants',
            'No ads — ever',
            'Quorum logic — minimum player threshold before a date is viable',
            'Waitlists with automatic promotion when spots open',
            'Discord and Telegram bot integration',
            'Campaign mode for multi-session scheduling',
            'Yes / If-Needed / No three-state voting',
            'One-click Google Calendar and .ICS export',
        ],
    }),
    SchemaGenerator.faq([
        {
            question: 'What does Tabletop Time have that When2Meet does not?',
            answer: 'Quorum logic (minimum player counts before a date is highlighted as viable), player capacity limits, first-come-first-serve waitlists, Discord and Telegram bot integration, campaign mode for multi-session scheduling, and If-Needed as a third vote state alongside Yes and No.',
        },
        {
            question: 'Is Tabletop Time free like When2Meet?',
            answer: 'Yes. Tabletop Time is completely free with no ads, no subscriptions, and no account required for organizers or participants. It is open source and can be self-hosted.',
        },
        {
            question: 'Does Tabletop Time require a sign-up?',
            answer: 'No. Neither organizers nor participants need an account. Create an event, share the link, players vote. Manager access is stored locally in your browser.',
        },
        {
            question: 'When would I still use When2Meet instead?',
            answer: 'When2Meet\'s hourly grid is excellent for finding overlapping time windows within a single day — useful for events where time of day matters as much as the date. If you just need to pick a night from a set of candidate dates, Tabletop Time is simpler and adds the gaming-specific features When2Meet lacks.',
        },
    ]),
];

const rows: { label: string; tt: boolean | string; w2m: boolean | string; note?: string }[] = [
    { label: 'No sign-up for organizers', tt: true, w2m: true },
    { label: 'No sign-up for participants', tt: true, w2m: true },
    { label: 'No ads', tt: true, w2m: false },
    { label: 'Quorum / minimum players', tt: true, w2m: false },
    { label: 'Waitlists & player capacity', tt: true, w2m: false },
    { label: 'Three-state voting (Yes / If-Needed / No)', tt: true, w2m: false, note: 'w2m is binary' },
    { label: 'Discord integration', tt: true, w2m: false },
    { label: 'Telegram integration', tt: true, w2m: false },
    { label: 'Campaign / multi-session mode', tt: true, w2m: false },
    { label: 'Calendar export (.ICS / Google)', tt: true, w2m: false },
    { label: 'Hourly time-of-day grid', tt: false, w2m: true, note: 'tt uses date-level slots' },
    { label: 'Open source', tt: true, w2m: false },
];

export default function VsWhen2MeetPage() {
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
                    <p className="text-indigo-400 font-mono text-sm uppercase tracking-widest">When2Meet Alternative</p>
                    <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                        Tabletop Time vs When2Meet
                    </h1>
                    <p className="text-slate-400 text-2xl md:text-3xl font-normal">
                        When2Meet is great. Here&apos;s what it&apos;s missing for game night.
                    </p>
                    <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">
                        When2Meet has a devoted following among gamers for good reason: it&apos;s fast, it&apos;s free, and it requires no account. If you&apos;re using it to schedule your sessions, you&apos;ve already made a better choice than Doodle. But there are a few gaps that matter a lot when you&apos;re the DM trying to hold a group together.
                    </p>
                    <Link
                        href="/new"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 font-semibold transition-all"
                    >
                        Try It Free <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>

                {/* What When2Meet gets right */}
                <section className="bg-emerald-950/30 border border-emerald-900/50 rounded-2xl p-8 space-y-4">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                        <ThumbsUp className="w-5 h-5" />
                        What When2Meet Gets Right
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                        When2Meet&apos;s hourly availability grid is genuinely elegant. You drag across time blocks, the overlap heat-map appears instantly, and everyone sees the same picture. No account required on either side. It&apos;s been solving the &ldquo;when is everyone free?&rdquo; problem cleanly since 2006.
                    </p>
                    <p className="text-slate-300 leading-relaxed">
                        If you need to find a two-hour window on a specific day — say, a one-shot on Saturday where start time matters — When2Meet&apos;s grid is hard to beat.
                    </p>
                </section>

                {/* Where it falls short */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-white">Where It Falls Short for Gaming Groups</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <Problem
                            title="Ads on every poll page"
                            body="When2Meet's free service shows ads to participants on the vote page. Every time a player fills in their availability, they're greeted with banner ads. Tabletop Time has no ads on any page, ever."
                        />
                        <Problem
                            title="No minimum player logic"
                            body="When2Meet shows you who's free. It doesn't know that you need at least 4 players to run the session. You still have to count highlighted cells and decide manually whether a date is viable."
                        />
                        <Problem
                            title="Binary voting only"
                            body="When2Meet is available or not — there's no 'If Needed' state. Players who are free but would rather skip can't express that nuance. It forces a false precision that misrepresents actual enthusiasm."
                        />
                        <Problem
                            title="No waitlists or seat limits"
                            body="For games with a hard player limit (4-person Commander pod, 5-player campaign), there's no way to set a max and manage overflow. You manage it in the group chat, which is exactly what you were trying to avoid."
                        />
                        <Problem
                            title="No Discord or Telegram integration"
                            body="When2Meet links get shared in Discord, but that's where the integration ends. Tabletop Time's bots bring voting directly into the server — players can respond without leaving the app where they already hang out."
                        />
                        <Problem
                            title="No multi-session or campaign support"
                            body="Running a campaign means scheduling a series of sessions. When2Meet has no mode for finding three viable Saturdays in a row or grouping candidate dates by session number. Each event is a separate poll with no connection to the others."
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
                                    <th className="py-4 px-4 font-normal text-slate-400">When2Meet</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {rows.map(({ label, tt, w2m, note }) => (
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
                                            {typeof w2m === 'string' ? (
                                                <span className="text-yellow-400 text-xs font-mono">{w2m}</span>
                                            ) : w2m ? (
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
                    <p className="text-xs text-slate-500">Comparison based on When2Meet free tier as of 2026.</p>
                </section>

                {/* Quorum logic callout */}
                <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 space-y-4">
                    <h2 className="text-2xl font-bold text-white">The If-Needed Vote State</h2>
                    <p className="text-slate-400 leading-relaxed">
                        When2Meet treats availability as binary: you&apos;re free or you&apos;re not. Real group dynamics are messier. The Cleric can make Saturday, but she&apos;d really rather Sunday. The Ranger is technically available but is flying back that morning and will be useless.
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                        Tabletop Time uses a three-state system: <strong className="text-white">Yes</strong>, <strong className="text-white">If Needed</strong>, and <strong className="text-white">No</strong>. The quorum algorithm counts &ldquo;If Needed&rdquo; as a soft yes — enough to hit quorum if no better option exists, but deprioritized when a date with all hard yeses is available. You get honest availability data, not forced binary answers.
                    </p>
                </section>

                {/* When to still use When2Meet */}
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-white">When to Still Use When2Meet</h2>
                    <p className="text-slate-400 leading-relaxed">
                        When2Meet&apos;s strength is hourly granularity within a day. If you&apos;re running a one-shot and need to know whether 7pm or 8pm start works better for a specific Saturday, When2Meet&apos;s drag-to-select hour grid is the right tool. Tabletop Time uses date-level slots, not hour-level grids.
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                        For campaigns and recurring sessions where the question is &ldquo;which of these three Saturdays in June works for everyone,&rdquo; Tabletop Time is the better fit.
                    </p>
                </section>

                {/* Migration CTA */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-white">Adding the Missing Pieces Takes Two Minutes</h2>
                    <p className="text-slate-400 leading-relaxed">
                        If you&apos;re already in the habit of sharing a When2Meet link, the switch is trivial. Go to <Link href="/new" className="text-indigo-400 hover:text-indigo-300 underline">tabletoptime.us/new</Link>, name your event, add candidate dates, and optionally set a quorum. Share the link. Your players get an experience similar to what they&apos;re used to — click a date, mark availability — with the added context of knowing which dates actually have enough players to happen.
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
                        <Faq q="Is Tabletop Time as simple as When2Meet?" a="For the voter: yes. Click a date, tap Yes / If-Needed / No, done. For the organizer, there's a bit more setup (quorum, player limit) — but you only fill in what you want. Skip the advanced options and it's just as fast." />
                        <Faq q="Can I use Tabletop Time for non-gaming events?" a="Yes. Quorum logic and waitlists are useful for any group activity with a minimum headcount. Sports teams, study groups, movie nights — anything that needs 'do we have enough people before it's worth doing' logic." />
                        <Faq q="Does it work on mobile?" a="Yes. The vote page is designed for one-thumb use on mobile. Tap the date, tap your vote, submit. No install required." />
                        <Faq q="What happens to my old When2Meet polls?" a="Nothing — they stay live. Tabletop Time doesn't import or replace old polls. Just start new events here going forward." />
                    </div>
                </section>

                <div className="border-t border-slate-800 pt-8 flex flex-wrap gap-6 text-sm text-slate-500">
                    <Link href="/features" className="hover:text-indigo-400 transition-colors">Full Feature List</Link>
                    <Link href="/vs/doodle" className="hover:text-indigo-400 transition-colors">vs Doodle</Link>
                    <Link href="/vs/lettucemeet" className="hover:text-indigo-400 transition-colors">vs LettuceMeet</Link>
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

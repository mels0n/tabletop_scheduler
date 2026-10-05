import {
    Users, Trophy, CalendarDays, CalendarCheck, Bot, Check, X, UserX, KeyRound, Clock,
    MapPin, Lightbulb, Vote, Home, Globe, LayoutList, Crown, BellRing, Pin, Megaphone,
    MessageSquare, ShieldCheck, Server, Code, SunMoon, HeartHandshake, UserMinus,
} from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SchemaGenerator } from '@/shared/lib/aeo';

export const metadata: Metadata = {
    title: 'Features: Game Night Scheduling Built for Tabletop Groups',
    description: 'The Doodle replacement built for gaming groups. Quorum logic, waitlists, campaign scheduling, Telegram & Discord bots with reminders, and no sign-up for anyone. Free forever.',
    alternates: {
        canonical: '/features',
    },
};

const schema = [
    SchemaGenerator.softwareApp({
        name: 'Tabletop Time',
        description: 'A free, no-sign-up game night scheduler for tabletop gaming groups. Doodle alternative with quorum logic, waitlists, campaign scheduling, and native Telegram & Discord bot integration.',
        applicationCategory: 'UtilitiesApplication',
        alternateName: 'Tabletop Scheduler',
        featureList: [
            'No sign-up required for organizers or participants',
            'Quorum logic: automatically highlights dates that meet minimum player count',
            'Waitlists and player capacity limits with automatic promotion',
            'Campaign mode for multi-session scheduling',
            'Yes, If Needed and No voting, plus a "can host" flag',
            'Participants can suggest new times',
            'Telegram bot integration: pinned live tally, reminders and results in group chat',
            'Discord bot integration: pinned live tally, reminders and results in your server',
            'Session reminders 2 hours, 1 day or 2 days before game night',
            'Google Calendar, Outlook and ICS event export',
            'Zero ads, zero tracking, open source and self-hostable with Docker',
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

const sections = [
    { id: 'plan', step: '1', label: 'Plan' },
    { id: 'vote', step: '2', label: 'Vote' },
    { id: 'lock-in', step: '3', label: 'Lock it in' },
    { id: 'chat', step: '4', label: 'Group chat' },
    { id: 'trust', step: '5', label: 'No strings' },
    { id: 'compare', step: '6', label: 'Compare' },
] as const;

export default function FeaturesPage() {
    return (
        <main className="min-h-screen bg-ink text-parchment px-4 py-10 md:p-12">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />
            <div className="max-w-6xl mx-auto space-y-24">

                {/* Hero */}
                <header className="text-center space-y-6 max-w-3xl mx-auto">
                    <p className="eyebrow">Features</p>
                    <h1 className="heading-display text-4xl md:text-6xl font-bold text-parchment">
                        More Than Just &quot;Finding a Time&quot;
                    </h1>
                    <p className="text-xl text-mist leading-relaxed">
                        Generic scheduling tools stop at the poll. Tabletop Time follows your game night
                        from the first proposed date to the reminder an hour before dice hit the table,
                        and nobody has to make an account.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 pt-2">
                        <Link href="/new" className="btn-primary">Start an event &rarr;</Link>
                        <Link href="/how-it-works" className="btn-secondary">See how it works</Link>
                    </div>
                    <nav aria-label="Feature sections" className="pt-6">
                        <ol className="flex flex-wrap justify-center gap-2">
                            {sections.map((s) => (
                                <li key={s.id}>
                                    <a
                                        href={`#${s.id}`}
                                        className="inline-flex items-center gap-2 rounded-control border border-line px-3 py-1.5 text-sm text-parchment-2 hover:border-gold hover:text-parchment transition-colors"
                                    >
                                        <span className="font-display text-gold-bright">{s.step}</span>
                                        {s.label}
                                    </a>
                                </li>
                            ))}
                        </ol>
                    </nav>
                </header>

                {/* 1. Plan */}
                <Section
                    id="plan"
                    step="1"
                    eyebrow="For the organizer"
                    title="Set up the table in a minute"
                    intro="Propose a few dates, say how many players you need, and share one link. That is the whole setup."
                >
                    <FeatureCard
                        icon={<UserX className="w-5 h-5" />}
                        title="No sign-up, ever"
                        description="No account, no email, no password. Create an event and you get a private admin link to manage it."
                    />
                    <FeatureCard
                        icon={<Users className="w-5 h-5" />}
                        title="Minimum and maximum players"
                        description="Tell us you need 4 for Commander or that the table seats 6. Everything downstream (quorum, waitlist, reminders) works from these numbers."
                    />
                    <FeatureCard
                        icon={<CalendarDays className="w-5 h-5" />}
                        title="One-shot or campaign"
                        description="Planning a single night or a D&D campaign, Legacy series, or recurring group? Campaign mode schedules a run of sessions instead of one date."
                    />
                    <FeatureCard
                        icon={<Clock className="w-5 h-5" />}
                        title="Flexible time slots"
                        description="Propose as many slots as you like and add, move or remove them after voting starts. Players see everything in their own time zone."
                    />
                    <FeatureCard
                        icon={<MapPin className="w-5 h-5" />}
                        title="Location and details"
                        description="Add a description and where you are playing, and update the location later if plans change."
                    />
                    <FeatureCard
                        icon={<KeyRound className="w-5 h-5" />}
                        title="Lost your link? No problem"
                        description="Recover admin access with a magic link sent to your linked Telegram or Discord account. No password reset emails."
                    />
                </Section>

                {/* 2. Vote */}
                <Section
                    id="vote"
                    step="2"
                    eyebrow="For the players"
                    title="Voting that understands game night"
                    intro="Players open the link, type a name, and tap their availability. The app does the math on who can actually play."
                >
                    <FeatureCard
                        icon={<Vote className="w-5 h-5" />}
                        title="Yes, If Needed, No"
                        description={`Three answers instead of two. "If Needed" means a player can make it but would rather not, so you only lean on it when it helps.`}
                    />
                    <FeatureCard
                        icon={<Trophy className="w-5 h-5" />}
                        title="Quorum logic"
                        description="Dates that hit your minimum player count are highlighted automatically, so the viable nights stand out at a glance."
                    />
                    <FeatureCard
                        icon={<LayoutList className="w-5 h-5" />}
                        title="Waitlists and capacity"
                        description="When a slot fills up, extra players join a first-come-first-serve waitlist and get promoted automatically if a seat opens."
                    />
                    <FeatureCard
                        icon={<Home className="w-5 h-5" />}
                        title="Who can host?"
                        description="Players can flag the nights they are able to host, so you pick a date and a table at the same time."
                    />
                    <FeatureCard
                        icon={<Lightbulb className="w-5 h-5" />}
                        title="Suggest a time"
                        description={`None of the dates work? Players can propose a new slot instead of replying "none of these" in chat.`}
                    />
                    <FeatureCard
                        icon={<Globe className="w-5 h-5" />}
                        title="Remembers you across devices"
                        description="Your browser remembers your vote, and linking Telegram or Discord keeps your events in sync on every device in My Events."
                    />
                </Section>

                {/* 3. Lock it in */}
                <section id="lock-in" aria-labelledby="lock-in-title" className="scroll-mt-24 grid md:grid-cols-2 gap-12 items-center">
                    <div className="space-y-6">
                        <SectionHeading
                            id="lock-in-title"
                            step="3"
                            eyebrow="It's not real until it's on the calendar"
                            title="Lock it in with one click"
                        />
                        <p className="text-mist text-lg leading-relaxed">
                            Pick the winning slot and a host, and the event is finalized for everyone.
                            Each player gets <strong>Google Calendar</strong> and <strong>Outlook</strong> buttons
                            plus a standard <strong>.ics</strong> file for Apple Calendar. No more &quot;I forgot&quot; excuses.
                        </p>
                        <ul className="space-y-4">
                            <Bullet icon={<Crown className="w-5 h-5" />} title="Finalize with a host">
                                Choose the date and who is hosting in the same step.
                            </Bullet>
                            <Bullet icon={<CalendarCheck className="w-5 h-5" />} title="Campaign sessions">
                                Campaign mode groups dates by shared availability. Pick the run that fits, tick the sessions, and every one gets its own calendar buttons.
                            </Bullet>
                            <Bullet icon={<UserMinus className="w-5 h-5" />} title="Cancellations handled">
                                Remove a player who dropped out and the next person on the waitlist moves up automatically.
                            </Bullet>
                        </ul>
                    </div>
                    <div className="card flex flex-col gap-4 text-center" aria-hidden="true">
                        <p className="eyebrow">Friday, 7:00 PM &middot; Hosted by Sam</p>
                        <div className="p-4 bg-gold text-on-gold rounded-control font-bold">
                            Add to Google Calendar
                        </div>
                        <div className="p-4 bg-surface-2 text-parchment-2 rounded-control font-bold">
                            Add to Outlook
                        </div>
                        <div className="p-4 bg-surface-2 text-parchment-2 rounded-control font-bold">
                            Download .ics file
                        </div>
                    </div>
                </section>

                {/* 4. Group chat */}
                <Section
                    id="chat"
                    step="4"
                    eyebrow="Telegram and Discord"
                    title="Lives where your group already talks"
                    intro="Connect the Telegram bot or the verified Discord bot to your group, and the scheduling happens in the chat instead of in a link everyone forgets to open."
                    footer={
                        <div className="flex flex-wrap justify-center gap-3">
                            <Link href="/guide/telegram-setup" className="btn-secondary">Telegram setup guide</Link>
                            <Link href="/guide/discord-setup" className="btn-secondary">Discord setup guide</Link>
                        </div>
                    }
                >
                    <FeatureCard
                        icon={<Pin className="w-5 h-5" />}
                        title="Pinned live tally"
                        description="The bot pins a dashboard in your group that updates as votes come in. Everyone sees where things stand without clicking anything."
                    />
                    <FeatureCard
                        icon={<BellRing className="w-5 h-5" />}
                        title="Nudges for stragglers"
                        description="Schedule voting reminders on the days and time you choose, so you stop being the person who chases everyone."
                    />
                    <FeatureCard
                        icon={<Clock className="w-5 h-5" />}
                        title="Session reminders"
                        description="Once the date is set, the bot reminds the group 2 hours, 1 day or 2 days before the game."
                    />
                    <FeatureCard
                        icon={<Megaphone className="w-5 h-5" />}
                        title="Announcements"
                        description="New time slots and the final result are posted to the group automatically."
                    />
                    <FeatureCard
                        icon={<MessageSquare className="w-5 h-5" />}
                        title="Private DMs"
                        description="Players get the final result and waitlist promotions by direct message. Organizers get their recovery links the same way."
                    />
                    <FeatureCard
                        icon={<Bot className="w-5 h-5" />}
                        title="Your DMs, your call"
                        description="Anyone can opt out of direct messages from the bot while still seeing everything in the group."
                    />
                </Section>

                {/* 5. Trust */}
                <Section
                    id="trust"
                    step="5"
                    eyebrow="No strings attached"
                    title="Free, private and yours to run"
                    intro="Tabletop Time is a community project, not a funnel. There is no paid tier waiting behind the good features."
                >
                    <FeatureCard
                        icon={<ShieldCheck className="w-5 h-5" />}
                        title="No ads, no tracking"
                        description="No analytics pixels, no ad networks, and no email addresses collected. We do not know who you are and we like it that way."
                    />
                    <FeatureCard
                        icon={<Code className="w-5 h-5" />}
                        title="Open source"
                        description={<>Every line is public on <a href="https://github.com/mels0n/tabletop_scheduler" className="text-gold hover:text-gold-bright underline underline-offset-[3px]">GitHub</a>, so you can see exactly what happens to your data.</>}
                    />
                    <FeatureCard
                        icon={<Server className="w-5 h-5" />}
                        title="Self-host it"
                        description="Run your own copy from the Docker image on a Synology, Unraid box or Raspberry Pi, with the same bots and features."
                    />
                    <FeatureCard
                        icon={<SunMoon className="w-5 h-5" />}
                        title="Light and dark"
                        description="Follows your system theme and is built to work with keyboards and screen readers."
                    />
                    <FeatureCard
                        icon={<HeartHandshake className="w-5 h-5" />}
                        title="Free forever"
                        description={<>Kept running by player donations, not by selling your data. See <Link href="/pricing" className="text-gold hover:text-gold-bright underline underline-offset-[3px]">pricing</Link> (spoiler: it is free).</>}
                    />
                    <FeatureCard
                        icon={<Users className="w-5 h-5" />}
                        title="Any group size"
                        description="From a four-person board game night to a packed league night, the same tools scale with you."
                    />
                </Section>

                {/* 6. Comparison */}
                <section id="compare" aria-labelledby="compare-title" className="scroll-mt-24 card md:p-8">
                    <div className="text-center mb-10">
                        <SectionHeading id="compare-title" step="6" eyebrow="Why switch?" title="How we stack up" centered />
                        <p className="text-mist mt-4">Compared against the general-purpose tools, including Doodle.</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[1100px]">
                            <thead>
                                <tr className="border-b border-line bg-surface text-mist text-sm">
                                    <th scope="col" className="py-4 pl-4 font-normal w-1/5">Feature</th>
                                    <th scope="col" className="py-4 px-2 font-bold text-gold-bright text-lg bg-surface-2">Tabletop Time</th>
                                    <th scope="col" className="py-4 px-2 font-normal"><Link href="/vs/doodle" className="hover:text-parchment transition-colors">Doodle</Link></th>
                                    <th scope="col" className="py-4 px-2 font-normal"><Link href="/vs/when2meet" className="hover:text-parchment transition-colors">When2Meet</Link></th>
                                    <th scope="col" className="py-4 px-2 font-normal"><Link href="/vs/lettucemeet" className="hover:text-parchment transition-colors">LettuceMeet</Link></th>
                                    <th scope="col" className="py-4 px-2 font-normal"><Link href="/vs/rallly" className="hover:text-parchment transition-colors">Rallly</Link></th>
                                    <th scope="col" className="py-4 px-2 font-normal">Calendar Apps</th>
                                    <th scope="col" className="py-4 px-2 font-normal">Group Chats</th>
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
                </section>

                {/* CTA */}
                <div className="text-center pt-6 space-y-6">
                    <div className="ornament" aria-hidden="true">✦</div>
                    <h2 className="heading-display text-3xl font-bold text-parchment">Ready for game night?</h2>
                    <p className="text-mist">Create an event, share the link, and let the table sort itself out.</p>
                    <Link href="/new" className="btn-primary px-8 py-4 text-lg">
                        Start Your First Event &rarr;
                    </Link>
                </div>

            </div>
        </main>
    );
}

function SectionHeading({ id, step, eyebrow, title, centered = false }: {
    id: string; step: string; eyebrow: string; title: string; centered?: boolean;
}) {
    return (
        <div className={centered ? 'text-center space-y-3' : 'space-y-3'}>
            <p className={`eyebrow inline-flex items-center gap-2 ${centered ? 'justify-center' : ''}`}>
                <span className="font-display">Step {step}</span>
                <span aria-hidden="true">&middot;</span>
                <span>{eyebrow}</span>
            </p>
            <h2 id={id} className="heading-display text-3xl md:text-4xl font-bold text-parchment">{title}</h2>
        </div>
    );
}

function Section({ id, step, eyebrow, title, intro, children, footer }: {
    id: string; step: string; eyebrow: string; title: string; intro: string;
    children: React.ReactNode; footer?: React.ReactNode;
}) {
    return (
        <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 space-y-10">
            <div className="max-w-2xl mx-auto text-center space-y-4">
                <SectionHeading id={`${id}-title`} step={step} eyebrow={eyebrow} title={title} centered />
                <p className="text-mist text-lg leading-relaxed">{intro}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {children}
            </div>
            {footer}
        </section>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: React.ReactNode }) {
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

function Bullet({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
        <li className="flex gap-4">
            <div className="icon-tile" aria-hidden="true">{icon}</div>
            <div>
                <p className="font-semibold text-parchment">{title}</p>
                <p className="text-parchment-2 leading-relaxed">{children}</p>
            </div>
        </li>
    );
}

function Cell({ value, note, good = true }: { value: boolean | string; note?: string; good?: boolean }) {
    if (typeof value === 'string') return <span className="text-xs text-maybe">{value}</span>;
    return value === good
        ? <Check className="w-5 h-5 text-yes inline" aria-label="Yes" />
        : note
            ? <span className="text-xs text-maybe">{note}</span>
            : <X className="w-5 h-5 text-no inline" aria-label="No" />;
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
            <th scope="row" className="py-4 pl-4 font-medium text-left">{label}</th>
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

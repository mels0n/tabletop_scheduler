import { Shield, EyeOff, Server, Ban } from 'lucide-react';
import GithubIcon from '@/components/GithubIcon';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SchemaGenerator } from '@/shared/lib/aeo';
import { publicConfig } from "@/shared/config/public";

export const metadata: Metadata = {
    title: 'No Ads, No Tracking: Schedule Board Games Privately',
    description: 'Schedule game nights with zero tracking, no ads, and no account required. Free, open-source scheduler for board games, D&D, MTG, and tabletop gaming groups.',
    alternates: {
        canonical: '/privacy',
    },
};

const schema = SchemaGenerator.faq([
    {
        question: 'Does Tabletop Time have ads?',
        answer: 'No. Tabletop Time has zero ads on any version of the app. There are no Google Analytics scripts, no ad networks, and no monetization of user data. It is completely ad-free.',
    },
    {
        question: 'Do I need an account to schedule a board game night?',
        answer: 'Absolutely not. You can schedule, vote, and manage events as a guest. Tabletop Time does not require an email or password from anyone (organizer or participant). Optionally, link Telegram or Discord for cross-device session recovery.',
    },
    {
        question: 'What data does Tabletop Time collect when scheduling games?',
        answer: 'Only the minimum needed: proposed dates, the display names participants provide (no verification required), and availability votes. No email, no account, no behavioral profiling, and no advertising identifiers.',
    },
    {
        question: 'How is game night data deleted?',
        answer: 'Automatically. On the hosted version, a cleanup job runs daily. Events are deleted one day after they end: a one-shot one day after its chosen slot ends, and a campaign one day after its last session. Drafts are deleted one day after their last proposed time, and cancelled events one day after cancellation. Self-hosters can change these with the CLEANUP_RETENTION_DAYS_* variables. Votes and participant names go with them, with no manual deletion required. Linked Discord or Telegram identities can also be removed instantly from the Privacy & Data page in your profile. No third-party analytics run on the hosted site.',
    },
    {
        question: 'Can I self-host this board game scheduler with no data leaving my network?',
        answer: 'Yes. Tabletop Time is open source and available as a Docker image. In self-hosted mode, all data stays on your own server with no third-party involvement.',
    },
    {
        question: 'Is Tabletop Time really free with no catch?',
        answer: 'Yes. Tabletop Time is free, has no ads, requires no account, and does not sell data. It is funded by optional Ko-fi donations. The source code is public on GitHub.',
    },
]);

export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-ink text-parchment p-6 md:p-12">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />
            <div className="max-w-screen-2xl mx-auto space-y-16">

                {/* Header */}
                <div className="space-y-6 text-center">
                    <div className="inline-flex items-center justify-center p-4 bg-surface-2 rounded-card mb-4">
                        <Shield className="w-12 h-12 text-gold-bright" aria-hidden="true" />
                    </div>
                    <h1 className="heading-display text-4xl md:text-5xl font-bold text-parchment">
                        The &quot;Zero Tracking&quot; Promise
                    </h1>
                    <p className="text-xl text-parchment-2 max-w-2xl mx-auto">
                        We believe that scheduling a board game night shouldn&apos;t require surrendering your personal data or sitting through ads.
                    </p>
                </div>

                {/* Core Pillars */}
                <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-8">
                    <div className="card p-8 space-y-4">
                        <EyeOff className="w-8 h-8 text-gold-bright" aria-hidden="true" />
                        <h2 className="heading-display text-2xl font-bold text-parchment">No Analytics</h2>
                        <p className="text-parchment-2 leading-relaxed">
                            We do not use Google Analytics, Facebook Pixels, or any third-party trackers on any version of Tabletop Scheduler. We simply do not know who you are.
                        </p>
                    </div>

                    <div className="card p-8 space-y-4">
                        <Ban className="w-8 h-8 text-gold-bright" aria-hidden="true" />
                        <h2 className="heading-display text-2xl font-bold text-parchment">No Ads. Ever.</h2>
                        <p className="text-parchment-2 leading-relaxed">
                            There are no ads on any page of Tabletop Time: no banners, no sponsored results, no promoted listings. Scheduling a board game, D&amp;D session, or MTG draft night should not come with an ad tax.
                        </p>
                    </div>

                    <div className="card p-8 space-y-4">
                        <GithubIcon className="w-8 h-8 text-gold-bright" />
                        <h2 className="heading-display text-2xl font-bold text-parchment">The Code IS the Audit</h2>
                        <p className="text-parchment-2 leading-relaxed">
                            Don&apos;t just take our word for it. Our entire codebase is Open Source on GitHub. You can inspect every line of code to verify that we are not harvesting your data.
                        </p>
                        <a href="https://github.com/mels0n/tabletop_scheduler" className="inline-flex items-center text-gold hover:text-gold-bright font-medium">
                            Audit the Code &rarr;
                        </a>
                    </div>

                    <div className="card p-8 space-y-4">
                        <Server className="w-8 h-8 text-gold-bright" aria-hidden="true" />
                        <h2 className="heading-display text-2xl font-bold text-parchment">Self-Hostable</h2>
                        <p className="text-parchment-2 leading-relaxed">
                            Want 100% control? Host Tabletop Scheduler on your own server using our Docker image. In self-hosted mode, no data ever leaves your network, not even anonymized telemetry.
                        </p>
                    </div>
                </div>

                {/* FAQ Section */}
                <div className="space-y-8">
                    <h2 className="heading-display text-3xl font-bold text-center text-parchment">Data Architecture</h2>

                    <div className="space-y-4 divide-y divide-line">
                        <div className="pt-4">
                            <h3 className="font-bold text-lg text-gold-bright mb-2">Q: Do I need an account?</h3>
                            <p className="text-parchment-2">
                                <strong>Absolutely not.</strong> You can schedule, vote, and manage events purely as a &quot;Guest&quot; using your browser&apos;s local storage. We do not require an email or password.
                                <br /><br />
                                <em>Optional:</em> You can link Telegram/Discord for cross-device recovery.
                            </p>
                        </div>

                        <div className="pt-8">
                            <h3 className="font-bold text-lg text-gold-bright mb-2">Q: What about cookies?</h3>
                            <p className="text-parchment-2">
                                We use cookies strictly for <strong>Persistence</strong>, not tracking.
                                <br /><br />
                                <span className="text-parchment-2 pl-4 border-l-2 border-line block">
                                    &quot;I want to close my browser and come back exactly as I left it.&quot;
                                </span>
                                <br />
                                That is what our cookies do, and these are the only ones we set: a <strong>manager cookie</strong> for each event you organize (set when you create the event or open its manager link), a signed <strong>participant cookie</strong> for each event you vote on (so only this browser can edit that vote), and, if you link Telegram or Discord, a signed <strong>identity cookie</strong> plus your display name. Discord sign-in also uses two short-lived cookies: one that guards the sign-in itself and one that lasts an hour after you add the bot to a server. Your name is remembered in your browser&apos;s local storage, not in a cookie. None of these cookies track you, carry an ad-tech ID, or are shared with anyone.
                            </p>
                        </div>

                        <div className="pt-8">
                            <h3 className="font-bold text-lg text-gold-bright mb-2">Q: How is my data deleted?</h3>
                            <p className="text-parchment-2">
                                <strong className="text-parchment">Automatically.</strong> On the hosted version, a cleanup job runs daily. Events are deleted one day after they end: a one-shot one day after its chosen slot ends, and a campaign one day after its last session. Drafts are deleted one day after their last proposed time, and cancelled events one day after cancellation. These are the defaults, and self-hosters can change them with the CLEANUP_RETENTION_DAYS_* variables. There is no manual step required, since old events, votes, and participant names are wiped from our database on that schedule. No third-party analytics run on the hosted site. If you want immediate deletion, the host can delete the event from its Manage page (a finalized event is cancelled first, then deleted), or you can self-host and control the data lifecycle yourself. Linked a Discord or Telegram account? You can remove that identity from all of your data instantly via &quot;Linked Accounts&quot; on your <Link href="/profile/privacy" className="text-gold hover:text-gold-bright underline underline-offset-[3px]">Privacy &amp; Data page</Link>.
                            </p>
                        </div>

                        <div className="pt-8">
                            <h3 className="font-bold text-lg text-gold-bright mb-2">Q: Is it Self-Hostable?</h3>
                            <p className="text-parchment-2">
                                <strong className="text-parchment">Yes.</strong> If you want 100% control, you can host Tabletop Scheduler on your own server using our Docker image. In this mode, no data ever leaves your network.
                            </p>
                        </div>

                        {publicConfig.isHosted && (
                            <div className="pt-8">
                                <h3 className="font-bold text-lg text-gold-bright mb-2">Q: To comply with various global privacy laws, does TableTop Time have a Formal Privacy Policy?</h3>
                                <p className="text-parchment-2">
                                    <strong className="text-parchment">Yes.</strong> For detailed legal compliance information, please see our <Link href="/legal" className="text-gold hover:text-gold-bright underline underline-offset-[3px]">Legal page</Link>.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="text-center pt-12 border-t border-line">
                    <Link href="/" className="text-mist hover:text-gold-bright transition-colors">
                        &larr; Back to Scheduler
                    </Link>
                </div>

            </div>
        </main>
    );
}

import { Shield, Lock, EyeOff, Github, Server } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Privacy Shield | Tabletop Time',
    description: 'We do not track you. Our code is open source. Our analytics are non-existent. Read our "Zero Tracking" manifesto.',
};

export default function PrivacyPage() {
    return (
        <main className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12">
            <div className="max-w-4xl mx-auto space-y-16">

                {/* Header */}
                <div className="space-y-6 text-center">
                    <div className="inline-flex items-center justify-center p-4 bg-emerald-500/10 rounded-full mb-4">
                        <Shield className="w-12 h-12 text-emerald-400" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        The &quot;Zero Tracking&quot; Promise
                    </h1>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                        We believe that organizing a board game night shouldn&apos;t require you to surrender your personal data.
                    </p>
                </div>

                {/* Core Pillars */}
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                        <EyeOff className="w-8 h-8 text-rose-400" />
                        <h2 className="text-2xl font-bold text-slate-200">No Analytics</h2>
                        <p className="text-slate-400 leading-relaxed">
                            We do not use Google Analytics, Facebook Pixels, or any third-party trackers on any version of Tabletop Scheduler. We simply do not know who you are.
                        </p>
                    </div>

                    <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                        <Github className="w-8 h-8 text-slate-100" />
                        <h2 className="text-2xl font-bold text-slate-200">The Code IS the Audit</h2>
                        <p className="text-slate-400 leading-relaxed">
                            Don&apos;t just take our word for it. Our entire codebase is Open Source on GitHub. You can inspect every line of code to verify that we are not harvesting your data.
                        </p>
                        <a href="https://github.com/mels0n/tabletop_scheduler" className="inline-flex items-center text-emerald-400 hover:text-emerald-300 font-medium">
                            Audit the Code &rarr;
                        </a>
                    </div>
                </div>

                {/* FAQ Section */}
                <div className="space-y-8">
                    <h2 className="text-3xl font-bold text-center">Data Architecture</h2>

                    <div className="space-y-4 divide-y divide-slate-800">
                        <div className="pt-4">
                            <h3 className="font-bold text-lg text-emerald-400 mb-2">Q: Do I need an account?</h3>
                            <p className="text-slate-300">
                                <strong>Absolutely not.</strong> You can schedule, vote, and manage events purely as a &quot;Guest&quot; using your browser&apos;s local storage. We do not require an email or password.
                                <br /><br />
                                <em>Optional:</em> You can link Telegram/Discord for cross-device recovery.
                            </p>
                        </div>

                        <div className="pt-8">
                            <h3 className="font-bold text-lg text-emerald-400 mb-2">Q: What about cookies?</h3>
                            <p className="text-slate-300">
                                We use cookies strictly for <strong>Persistence</strong>, not tracking.
                                <br /><br />
                                <span className="text-slate-400 pl-4 border-l-2 border-slate-700 block">
                                    &quot;I want to close my browser and come back exactly as I left it.&quot;
                                </span>
                                <br />
                                That is what our cookie does. It restores your session so you don&apos;t have to re-enter your name. It contains no ad-tech ID.
                            </p>
                        </div>

                        <div className="pt-8">
                            <h3 className="font-bold text-lg text-emerald-400 mb-2">Q: Is it Self-Hostable?</h3>
                            <p className="text-slate-300">
                                <strong className="text-white">Yes.</strong> If you want 100% control, you can host Tabletop Scheduler on your own server using our Docker image. In this mode, no data ever leaves your network.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="text-center pt-12 border-t border-slate-800">
                    <Link href="/" className="text-slate-500 hover:text-slate-300 transition-colors">
                        &larr; Back to Scheduler
                    </Link>
                </div>

            </div>
        </main>
    );
}

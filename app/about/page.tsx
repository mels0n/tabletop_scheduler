
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, Users, Code2, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
    title: "About Tabletop Time",
    description: "Tabletop Time was built by Christopher Melson to solve the hardest problem in tabletop gaming: scheduling. Privacy-first, no login required, 100% open source.",
    alternates: {
        canonical: '/about',
    },
};

const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "Person",
            "@id": "https://tabletoptime.us/about#founder",
            "name": "Christopher Melson",
            "url": "https://chris.melson.us/",
            "sameAs": [
                "https://chris.melson.us/",
                "https://github.com/mels0n"
            ],
            "jobTitle": "Founder",
            "worksFor": {
                "@type": "Organization",
                "name": "Tabletop Time",
                "url": "https://tabletoptime.us"
            }
        },
        {
            "@type": "Organization",
            "@id": "https://tabletoptime.us#organization",
            "name": "Tabletop Time",
            "url": "https://tabletoptime.us",
            "founder": {
                "@type": "Person",
                "name": "Christopher Melson",
                "url": "https://chris.melson.us/"
            },
            "description": "Privacy-first, open-source tabletop game session scheduler. No login required.",
            "sameAs": [
                "https://github.com/mels0n/tabletop_scheduler"
            ],
            "logo": {
                "@type": "ImageObject",
                "url": "https://tabletoptime.us/icon.png"
            }
        },
        {
            "@type": "AboutPage",
            "url": "https://tabletoptime.us/about",
            "name": "About Tabletop Time",
            "description": "The story behind Tabletop Time and its founder, Christopher Melson.",
            "about": {
                "@id": "https://tabletoptime.us#organization"
            }
        }
    ]
};

export default function AboutPage() {
    const isHosted = process.env.NEXT_PUBLIC_IS_HOSTED === "true";

    if (!isHosted) {
        notFound();
    }

    return (
        <main className="min-h-screen pt-24 pb-16 px-4 bg-slate-950 text-slate-50">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <div className="max-w-4xl mx-auto space-y-16">

                {/* Header */}
                <section className="text-center space-y-6">
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                        About Tabletop Time
                    </h1>
                    <p className="text-xl text-slate-400 leading-relaxed max-w-2xl mx-auto">
                        To eliminate the &quot;scheduling boss&quot; so you can focus on the actual boss fight.
                    </p>
                </section>

                {/* Story / Context */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div className="space-y-6 text-lg text-slate-300">
                        <p>
                            <strong>Tabletop Time</strong> was built by{" "}
                            <a href="https://chris.melson.us/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
                                Christopher Melson
                            </a>
                            , a software developer and lifelong tabletop gamer, after his own Magic: The Gathering group started falling apart — not because of drama, but because adults with jobs and kids can&apos;t coordinate over group chats.
                        </p>
                        <p>
                            Doodle polls required logins and felt corporate. We needed something <strong>fast, private, and specific to gamers</strong>.
                        </p>
                        <p>
                            So he built it. No venture capital, no data selling — just a tool to help us play more games.
                        </p>
                    </div>
                    <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800">
                        <h3 className="text-xl font-bold text-white mb-4">The &quot;No Login&quot; Philosophy</h3>
                        <p className="text-slate-400 mb-6">
                            You shouldn&apos;t have to trade your privacy to schedule a game night.
                        </p>
                        <ul className="space-y-3">
                            <li className="flex gap-3 text-sm text-slate-300">
                                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                                <span>No mining or selling of your data</span>
                            </li>
                            <li className="flex gap-3 text-sm text-slate-300">
                                <Users className="w-5 h-5 text-indigo-400" />
                                <span>Identity stored locally on your device</span>
                            </li>
                            <li className="flex gap-3 text-sm text-slate-300">
                                <Code2 className="w-5 h-5 text-indigo-400" />
                                <span>100% Open Source code</span>
                            </li>
                        </ul>
                    </div>
                </section>

                {/* CTA */}
                <section className="text-center pt-8">
                    <Link
                        href="/new"
                        className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold transition-all shadow-xl shadow-indigo-600/20"
                    >
                        Start Scheduling
                        <ArrowRight className="w-5 h-5" />
                    </Link>
                </section>

            </div>
        </main>
    );
}

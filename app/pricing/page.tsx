
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { publicConfig } from "@/shared/config/public";

export const metadata: Metadata = {
    title: "Pricing: Free Forever",
    description: "Tabletop Time is a free, open-source D&D session scheduler. No subscriptions, no paywalls, just gaming.",
    alternates: {
        canonical: '/pricing',
    },
};

const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": "https://tabletoptime.us/#software",
    "name": "Tabletop Time",
    "applicationCategory": "UtilitiesApplication",
    "operatingSystem": "Web",
    "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free forever, with no subscriptions, no paywalls.",
        "availability": "https://schema.org/InStock"
    }
};

export default function PricingPage() {
    const isHosted = publicConfig.isHosted;

    // Constraint Check
    if (!isHosted) {
        notFound();
    }

    return (
        <main className="min-h-screen pt-24 pb-16 px-4 bg-ink text-parchment">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <div className="max-w-5xl mx-auto text-center space-y-8">
                <h1 className="font-display text-4xl md:text-5xl font-bold text-parchment">
                    Simple, Transparent Pricing
                </h1>
                <p className="text-xl text-parchment-2">
                    We believe coordinating your game night shouldn&apos;t cost as much as the snacks.
                </p>

                <div className="card-accent mt-12 p-8 max-w-md mx-auto">
                    <h2 className="font-display text-2xl font-bold text-parchment mb-2">Community Edition</h2>
                    <div className="font-display text-5xl font-bold text-gold-bright mb-6 tabular-nums">
                        $0 <span className="text-lg font-normal text-mist">/ forever</span>
                    </div>

                    <ul className="space-y-4 text-left mb-8">
                        <FeatureItem text="Unlimited Events" />
                        <FeatureItem text="Unlimited Players" />
                        <FeatureItem text="Discord & Telegram Integration" />
                        <FeatureItem text="No Account Required" />
                        <FeatureItem text="Privacy First" />
                        <FeatureItem text="Open Source" />
                    </ul>

                    <Link
                        href="/new"
                        className="btn-primary w-full"
                    >
                        Start Scheduling Free
                    </Link>
                </div>

                <div className="mt-16 text-parchment-2 space-y-12">
                    <div className="space-y-4">
                        <h3 className="font-display text-xl font-bold text-parchment">Why is it free?</h3>
                        <p>
                            Tabletop Time is a passion project built by gamers, for gamers.
                            Running on standard web tech keeps costs low. <a href="https://chris.melson.us" target="_blank" rel="noopener noreferrer" className="text-gold hover:text-gold-bright underline underline-offset-[3px]">I</a> cover the costs for my own use, and sometimes people buy me a coffee to help. We won&apos;t ever show ads. You can also host it yourself!
                        </p>
                    </div>

                    <div className="space-y-4 flex flex-col items-center">
                        <h3 className="font-display text-xl font-bold text-parchment">How to Support the Project</h3>

                        <a href="https://ko-fi.com/N4N11VDWCU" target="_blank" rel="noopener noreferrer" className="pt-2 hover:opacity-90 transition-opacity">
                            {/* eslint-disable-next-line @next/next/no-img-element -- external Ko-fi badge; images.unoptimized is on */}
                            <img height="36" style={{ border: 0, height: 36 }} src="https://storage.ko-fi.com/cdn/kofi6.png?v=6" alt="Buy Me a Coffee at ko-fi.com" />
                        </a>
                    </div>
                </div>
            </div>
        </main>
    );
}

function FeatureItem({ text }: { text: string }) {
    return (
        <li className="flex items-center gap-3 text-parchment-2">
            <CheckCircle2 className="w-5 h-5 text-yes flex-shrink-0" aria-hidden="true" />
            <span>{text}</span>
        </li>
    );
}


import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
    title: "Pricing | Tabletop Time - Free Forever",
    description: "Tabletop Time is a free, open-source D&D session scheduler. No subscriptions, no paywalls, just gaming.",
};

export default function PricingPage() {
    const isHosted = process.env.NEXT_PUBLIC_IS_HOSTED === "true";

    // Constraint Check
    if (!isHosted) {
        notFound();
    }

    return (
        <main className="min-h-screen pt-24 pb-16 px-4 bg-slate-950 text-slate-50">
            <div className="max-w-3xl mx-auto text-center space-y-8">
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                    Simple, Transparent Pricing
                </h1>
                <p className="text-xl text-slate-400">
                    We believe coordinating your game night shouldn&apos;t cost as much as the snacks.
                </p>

                <div className="mt-12 bg-slate-900/50 border border-slate-800 rounded-3xl p-8 max-w-md mx-auto hover:border-indigo-500/50 transition-colors shadow-2xl">
                    <h2 className="text-2xl font-bold text-white mb-2">Community Edition</h2>
                    <div className="text-5xl font-extrabold text-indigo-400 mb-6">
                        $0 <span className="text-lg font-normal text-slate-500">/ forever</span>
                    </div>

                    <ul className="space-y-4 text-left mb-8">
                        <FeatureItem text="Unlimited Events" />
                        <FeatureItem text="Unlimited Players" />
                        <FeatureItem text="Discord & Telegram Integration" />
                        <FeatureItem text="No Account Required" />
                        <FeatureItem text="Privacy First (No Tracking)" />
                        <FeatureItem text="Open Source" />
                    </ul>

                    <Link
                        href="/new"
                        className="block w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold transition-all"
                    >
                        Start Scheduling Free
                    </Link>
                </div>

                <div className="mt-16 text-slate-400 space-y-4">
                    <h3 className="text-xl font-bold text-slate-200">Why is it free?</h3>
                    <p>
                        Tabletop Time is a passion project built by gamers, for gamers.
                        Running on standard web tech keeps costs low, and we utilize privacy-preserving ads to cover server coffee.
                        You can also host it yourself!
                    </p>
                </div>
            </div>
        </main>
    );
}

function FeatureItem({ text }: { text: string }) {
    return (
        <li className="flex items-center gap-3 text-slate-300">
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
            <span>{text}</span>
        </li>
    );
}

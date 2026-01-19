"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SchemaGenerator } from "@/shared/lib/aeo";

/**
 * @component FAQPage
 * @description Static "Frequently Asked Questions" page.
 *
 * Design:
 * - Simple, text-heavy layout optimized for readability.
 * - Explains the philosophy of "Account-less Scheduling" and privacy model.
 * - Pure client component for simplicity, though could be RSC.
 */
import { FAQItem } from "@/components/FAQItem";
import { DataTooltip } from "@/components/DataTooltip";


/**
 * @component FAQPage
 * @description Static "Frequently Asked Questions" page.
 *
 * Design:
 * - Simple, text-heavy layout optimized for readability.
 * - Explains the philosophy of "Account-less Scheduling" and privacy model.
 * - Pure client component for simplicity, though could be RSC.
 */
export default function FAQPage() {
    const isHosted = process.env.NEXT_PUBLIC_IS_HOSTED === "true";

    const jsonLd = SchemaGenerator.faq([
        {
            question: "Wait, I don't need an account?",
            answer: "That's right! TabletopTime is designed for low-friction scheduling. We know it's hard enough to get 5 people to agree on a time, let alone get them all to sign up for a new service."
        },
        {
            question: "How does the app remember who I am?",
            answer: "We use your browser's local storage to remember your name and the events you've interacted with. This means if you clear your cache, use incognito mode, or switch devices, you will look like a new user and can vote again."
        },
        {
            question: "Where is my data stored?",
            answer: "If you are using the hosted version, your data is stored securely in Supabase. We automatically purge events once a day if they are older than 24 hours to ensure your privacy. If you are self-hosting, the data lives on your own server."
        },
        {
            question: "How do I find my past events?",
            answer: "Check out the 'My Events' page! Since we don't have accounts, we track the events you visit on this device and list them there for easy access."
        },
        {
            question: "What is a 'Magic Link'?",
            answer: "If you switch devices, you can generate a 'Magic Link' via Telegram or Discord. This secure link verifies your identity and restores access to all your events on the new device."
        },
        {
            question: "How does the waitlist work?",
            answer: "Yes votes always come first. If Needed votes are only used to help reach the minimum player count. If there are enough 'Yes' votes to play, 'If Needed' players will remain on the waitlist. Once finalized, the list is locked."
        },
        {
            question: "How do timezones work?",
            answer: "TabletopTime is timezone-aware! We detect your timezone from your browser. Times listed in the app (like voting slots) are automatically converted to your local time. However, notification messages (like in Telegram or Discord) are sent in the Event's timezone to keep everyone on the same page. We always label timestamps so you know exactly which timezone you are looking at."
        },
        {
            question: "Why did I make this tool?",
            answer: "Tabletop Time started because my own Magic: The Gathering group was falling apart. We needed something fast, private, and specific to gamers."
        }
    ]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <div className="max-w-3xl mx-auto space-y-8">
                <Link href="/" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors mb-4">
                    <ArrowLeft className="w-4 h-4" /> Back Home
                </Link>

                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                    Frequently Asked Questions
                </h1>

                <div className="space-y-6">
                    <FAQItem
                        question="Wait, I don't need an account?"
                        answer="That's right! TabletopTime is designed for low-friction scheduling. We know it's hard enough to get 5 people to agree on a time, let alone get them all to sign up for a new service."
                    />
                    <FAQItem
                        question="How does the app remember who I am?"
                        answer="For verified users (Telegram/Discord), we use a secure cookie that lasts for 400 days and auto-refreshes every time you visit. For anonymous users, we use your browser's local storage to remember your name."
                    />


                    <FAQItem
                        question="Where is my data stored?"
                        answer={
                            <span>
                                If you are using the hosted version, your data is stored securely in Supabase. We automatically purge events once a day if they are older than 24 hours to ensure your privacy. We don&apos;t mine, sell, or keep your <DataTooltip />. If you are self-hosting, the data lives on your own server and stays with you.
                            </span>
                        }
                    />
                    <FAQItem
                        question="How do I find my past events?"
                        answer="Check out the 'My Events' page! Since we don't have accounts, we track the events you visit on this device and list them there for easy access."
                    />
                    <FAQItem
                        question="What is a 'Magic Link'?"
                        answer="(Optional) If you switch devices, you can generate a 'Magic Link' via Telegram or Discord. This secure link verifies your identity and restores access to all your events on the new device."
                    />
                    <FAQItem
                        question="How does the waitlist work?"
                        answer={
                            <span>
                                Yes votes always come first. If Needed votes are only used to help reach the minimum player count. If there are enough &quot;Yes&quot; votes to play, &quot;If Needed&quot; players will remain on the waitlist. Once finalized, the list is locked.{" "}
                                <Link href="/voting-logic" className="text-indigo-400 hover:text-indigo-300 underline">
                                    See full logic & examples
                                </Link>.
                            </span>
                        }
                    />
                    <FAQItem
                        question="Why did I make this tool?"
                        answer="I have a group of friends that plays Magic the Gathering - some of whom flat refuse to create an account at some data farming website. If I'm honest, I'd prefer to control my own data too. Also, some have families, some work strange hours, some have season tickets to sports, some have kids playing sports... trying to find a date that works for everyone is chaos."
                    />

                    {isHosted && (
                        <div className="pt-8 border-t border-slate-800">
                            <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-4">
                                Developers & Integration
                            </h2>
                            <FAQItem
                                question="Can I integrate this with my own site?"
                                answer={
                                    <span>
                                        Absolutely! We have a public API that lets you pre-fill event details, creating voting links from your own community Discord or website.{" "}
                                        <Link href="/developers" className="text-indigo-400 hover:text-indigo-300 underline">
                                            Check out the Developer Guide
                                        </Link>.
                                    </span>
                                }
                            />
                            <FAQItem
                                question="Found a bug or have an idea?"
                                answer={
                                    <span>
                                        We are open source! Please report bugs or request features directly on our{" "}
                                        <a href="https://github.com/mels0n/tabletop_scheduler/issues" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
                                            GitHub Repository
                                        </a>.
                                    </span>
                                }
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}


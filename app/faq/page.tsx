"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12">
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
                        answer="We use your browser's local storage to remember your name and the events you've interacted with. This means if you clear your cache, use incognito mode, or switch devices, you will look like a new user and can vote again."
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
                        answer="Check out the 'My Profile' page! Since we don't have accounts, we track the events you visit on this device and list them there for easy access."
                    />
                    <FAQItem
                        question="What is a 'Magic Link'?"
                        answer="(Optional) If you switch devices, you can generate a 'Magic Link' via Telegram or Discord. This secure link verifies your identity and restores access to all your events on the new device."
                    />
                    <FAQItem
                        question="How does the waitlist work?"
                        answer="For events with a player limit, we prioritize people who vote 'Available' (Yes) over 'If Needed' (Maybe). If the event is full, 'Yes' votes get first dibs (based on who voted first), then 'Maybe' votes. Everyone else is placed on the waitlist in order."
                    />
                    <FAQItem
                        question="Why did I make this tool?"
                        answer="I have a group of friends that plays Magic the Gathering - some of whom flat refuse to create an account at some data farming website. If I'm honest, I'd prefer to control my own data too. Also, some have families, some work strange hours, some have season tickets to sports, some have kids playing sports... trying to find a date that works for everyone is chaos."
                    />
                </div>
            </div>
        </div>
    )
}


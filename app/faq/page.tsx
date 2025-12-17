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
                        question="Why do I not need to create an account?"
                        answer="TabletopTime is designed for low-friction scheduling. We know it's hard enough to get 5 people to agree on a time, let alone get them all to sign up for a new service."
                    />
                    <FAQItem
                        question="How does the app remember who I am?"
                        answer="We use your browser's local storage to remember your name and the events you've interacted with. This means if you clear your cache, use incognito mode, or switch devices, you will look like a new user and can vote again."
                    />
                    <FAQItem
                        question="Where is my data stored?"
                        answer="If you are self-hosting this, the data lives right on your own server. We don't see anything. It stays with you."
                    />
                    <FAQItem
                        question="How do I find my past events?"
                        answer="Check out the 'My Profile' page! Since we don't have accounts, we track the events you visit on this device and list them there for easy access."
                    />
                </div>
            </div>
        </div>
    )
}


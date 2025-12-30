
import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
    title: 'How to Setup a Telegram Bot for Tabletop Time | Visual Guide',
    description: 'A step-by-step guide to creating a Telegram Bot for your self-hosted Tabletop Time instance. Learn how to get an API token, configure webhooks, and enable pin permissions.',
    alternates: {
        canonical: '/guide/telegram-setup',
    },
};

export default function TelegramSetupPage() {
    const isHosted = process.env.NEXT_PUBLIC_IS_HOSTED === "true";

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "HowTo",
        "name": "How to Setup a Telegram Bot for Tabletop Time",
        "description": "Create and configure a Telegram Bot to enable event notifications and pinning for your gaming group.",
        "step": [
            {
                "@type": "HowToStep",
                "name": "Create a Bot",
                "text": "Open Telegram, search for @BotFather, and send the command /newbot to create a new bot and get your API Token."
            },
            {
                "@type": "HowToStep",
                "name": "Configure Environment",
                "text": "Add the provided token to your TELEGRAM_BOT_TOKEN environment variable in docker-compose.yml."
            },
            {
                "@type": "HowToStep",
                "name": "Grant Admin Permissions",
                "text": "Add the bot to your Telegram group as an Administrator with 'Pin Messages' permission enabled."
            }
        ]
    };

    return (
        <main className="min-h-screen bg-slate-950 text-slate-50 py-12 px-4 md:px-8">
            {isHosted && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            )}

            <div className="max-w-3xl mx-auto">
                <Link href="/" className="inline-flex items-center text-indigo-400 hover:text-indigo-300 mb-8 transition-colors group">
                    <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                    Back to Home
                </Link>

                <article className="prose prose-invert prose-lg max-w-none prose-headings:text-indigo-100 prose-a:text-indigo-400 hover:prose-a:text-indigo-300 prose-strong:text-slate-100">
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-6">
                        Telegram Bot Setup Guide
                    </h1>

                    <p className="lead text-xl text-slate-400 mb-8">
                        Since Tabletop Time is privacy-first and self-hosted, you need to provide your own Telegram Bot for group notifications to work.
                        Don&apos;t worry—it takes about 2 minutes.
                    </p>

                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-10 not-prose">
                        <h3 className="text-lg font-semibold text-amber-400 mb-2 flex items-center gap-2">
                            ⚠️ Critical Requirement
                        </h3>
                        <p className="text-slate-300">
                            For the bot to <strong>Pin Messages</strong> (like the live event dashboard), it must be an <strong>Administrator</strong> in your group with the &quot;Pin Messages&quot; permission enabled.
                        </p>
                    </div>

                    <h2>1. Create a Bot</h2>
                    <ol>
                        <li>Open Telegram and search for <strong>@BotFather</strong>.</li>
                        <li>Send the command <code>/newbot</code>.</li>
                        <li>Follow the prompts to name your bot (e.g., <code>MyGamingGroupSchedulerBot</code>).</li>
                        <li><strong>Copy the API Token</strong> provided (it looks like <code>123456789:ABCdefGhI...</code>).</li>
                    </ol>

                    <h2>2. Configure Your Environment</h2>
                    <p>Add this token to your <code>docker-compose.yml</code> or <code>.env</code> file:</p>
                    <pre className="bg-slate-900 p-4 rounded-lg"><code>TELEGRAM_BOT_TOKEN=your_token_here</code></pre>

                    <h2>3. Deployment Modes</h2>
                    <p>Tabletop Time supports two modes for the Telegram Bot automatically:</p>

                    <div className="grid md:grid-cols-2 gap-6 not-prose my-8">
                        <div className="bg-slate-900/30 p-5 rounded-lg border border-slate-800">
                            <h3 className="text-lg font-semibold text-indigo-300 mb-2">Polling (Default)</h3>
                            <p className="text-sm text-slate-400 mb-3">Best for Home Servers (Docker)</p>
                            <ul className="text-sm text-slate-300 space-y-2 list-disc pl-4">
                                <li>No public domain required</li>
                                <li>Simply do NOT set <code>NEXT_PUBLIC_BASE_URL</code></li>
                            </ul>
                        </div>

                        <div className="bg-slate-900/30 p-5 rounded-lg border border-slate-800">
                            <h3 className="text-lg font-semibold text-indigo-300 mb-2">Webhook</h3>
                            <p className="text-sm text-slate-400 mb-3">Best for Cloud / Vercel</p>
                            <ul className="text-sm text-slate-300 space-y-2 list-disc pl-4">
                                <li>Requires HTTPS public domain</li>
                                <li>Set <code>NEXT_PUBLIC_BASE_URL</code> to your app URL</li>
                            </ul>
                        </div>
                    </div>

                    <h2>4. Using the Bot</h2>
                    <p>
                        Once your event is created:
                    </p>
                    <ol>
                        <li>Go to the <strong>Manager Dashboard</strong>.</li>
                        <li>Click <strong>&quot;Connect Telegram&quot;</strong>.</li>
                        <li>This will open Telegram and prompt you to add the bot as an Admin.</li>
                        <li>Once added, the bot will automatically post the event dashboard to the group!</li>
                    </ol>

                </article>
            </div>
        </main>
    );
}


import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SchemaGenerator } from '@/shared/lib/aeo';
import { publicConfig } from "@/shared/config/public";

export const metadata: Metadata = {
    title: 'How to Setup a Telegram Bot | Visual Guide',
    description: 'A step-by-step guide to creating a Telegram Bot for your self-hosted Tabletop Time instance. Learn how to get an API token, configure webhooks, and enable pin permissions.',
    // Canonical only applies to self-hosted: this page explicitly returns notFound() in hosted mode.
    ...(!publicConfig.isHosted && {
        alternates: { canonical: '/guide/telegram-setup' },
    }),
};


export default function TelegramSetupPage() {
    const isHosted = publicConfig.isHosted;

    if (isHosted) {
        notFound();
    }

    const jsonLd = SchemaGenerator.howTo({
        name: "How to Setup a Telegram Bot for Tabletop Time",
        description: "Create and configure a Telegram Bot to enable event notifications and pinning for your gaming group.",
        steps: [
            {
                name: "Create a Bot",
                text: "Open Telegram, search for @BotFather, and send the command /newbot to create a new bot and get your API Token."
            },
            {
                name: "Configure Environment",
                text: "Add the provided token to your TELEGRAM_BOT_TOKEN environment variable in docker-compose.yml."
            },
            {
                name: "Grant Admin Permissions",
                text: "Add the bot to your Telegram group as an Administrator with 'Pin Messages' permission enabled."
            }
        ]
    });

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
                        Don&apos;t worry, it takes about 2 minutes.
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
                    <p>Tabletop Time supports two modes for the Telegram Bot, chosen with <code>TELEGRAM_MODE</code> (<code>webhook</code>, <code>polling</code>, or <code>off</code>). When a token and a base URL are both set, the default is webhook. Both modes need <code>NEXT_PUBLIC_BASE_URL</code> set whenever a bot token is configured, because every link the bot sends points at it, and the app will not start without it.</p>

                    <div className="grid md:grid-cols-2 gap-6 not-prose my-8">
                        <div className="bg-slate-900/30 p-5 rounded-lg border border-slate-800">
                            <h3 className="text-lg font-semibold text-indigo-300 mb-2">Polling</h3>
                            <p className="text-sm text-slate-400 mb-3">Best for Home Servers (Docker)</p>
                            <ul className="text-sm text-slate-300 space-y-2 list-disc pl-4">
                                <li>No public domain required, so it works behind NAT</li>
                                <li>Set <code>TELEGRAM_MODE=polling</code></li>
                                <li>Still set <code>NEXT_PUBLIC_BASE_URL</code> to an address your players can open (it does not need to be public)</li>
                            </ul>
                        </div>

                        <div className="bg-slate-900/30 p-5 rounded-lg border border-slate-800">
                            <h3 className="text-lg font-semibold text-indigo-300 mb-2">Webhook (Default)</h3>
                            <p className="text-sm text-slate-400 mb-3">Best for Cloud / Vercel</p>
                            <ul className="text-sm text-slate-300 space-y-2 list-disc pl-4">
                                <li>Requires HTTPS public domain</li>
                                <li>Set <code>NEXT_PUBLIC_BASE_URL</code> to your app URL</li>
                                <li>The webhook is registered automatically when the app starts</li>
                            </ul>
                        </div>
                    </div>

                    <h2>4. Using the Bot</h2>
                    <p>
                        Once your event is created:
                    </p>
                    <ol>
                        <li>Open the event&apos;s <strong>Manage</strong> page.</li>
                        <li>In <strong>Connect Telegram Group</strong>, add the bot to your group if it is not there yet. The &quot;Add to Group&quot; button asks for the Pin Messages permission.</li>
                        <li>Copy the connect command shown on the Manage page. It looks like <code>/connect your-event-code 1a2b3c4d</code>.</li>
                        <li>Send that command in the group. The bot posts the live event dashboard and pins it.</li>
                    </ol>
                    <p>
                        Adding the bot, pasting the event link, or sending <code>/connect</code> without the code does not connect anything. Each code works once; to connect again, copy the fresh command from the Manage page.
                    </p>
                    <p>
                        Anyone can sign in from a new device by sending <code>/start login</code> to the bot in a private chat. The bot replies with a login link that is valid for 15 minutes.
                    </p>

                </article>
            </div>
        </main>
    );
}

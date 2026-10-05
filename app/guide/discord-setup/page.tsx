import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Bot, ExternalLink } from 'lucide-react';
import { SchemaGenerator } from '@/shared/lib/aeo';
import { publicConfig } from "@/shared/config/public";

export const metadata: Metadata = {
    title: 'How to Setup Discord Integration',
    description: 'Learn how to connect a Discord Bot to TabletopTime for event notifications, pinned dashboards, and seamless login recovery.',
    alternates: {
        canonical: '/guide/discord-setup',
    },
};


export default function DiscordSetupGuide() {
    if (publicConfig.isHosted) {
        notFound();
    }
    return (
        <main className="min-h-screen bg-ink text-parchment p-6 md:p-12">
            <div className="max-w-screen-2xl mx-auto space-y-12">

                {/* Header */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 text-gold-bright">
                        <Bot className="w-8 h-8" aria-hidden="true" />
                        <span className="eyebrow">Feature Guide</span>
                    </div>
                    <h1 className="heading-display text-4xl md:text-5xl font-bold text-parchment">Discord Integration Setup</h1>
                    <p className="text-xl text-parchment-2 leading-relaxed">
                        Step-by-step instructions to creating a Discord Bot and connecting it to your self-hosted TabletopTime instance.
                    </p>
                </div>

                {/* Step 1 */}
                <section className="space-y-4">
                    <h2 className="heading-display text-2xl font-bold text-parchment flex items-center gap-3">
                        <span className="border border-gold text-gold w-8 h-8 rounded-control flex items-center justify-center text-sm tabular-nums shrink-0">1</span>
                        Create a Discord Application
                    </h2>
                    <div className="pl-11 space-y-4 text-parchment-2">
                        <p>
                            To get started, you need to create an application in the Discord Developer Portal.
                        </p>
                        <ul className="list-disc space-y-2 pl-4">
                            <li>Go to the <a href="https://discord.com/developers/applications" target="_blank" className="text-gold hover:text-gold-bright underline underline-offset-[3px] inline-flex items-center gap-1">Developer Portal <ExternalLink className="w-3 h-3" aria-hidden="true" /></a>.</li>
                            <li>Click <strong>New Application</strong> and give it a name (e.g., &quot;TabletopScheduler&quot;).</li>
                            <li>Copy the <strong>Application ID</strong>. You will need this for the <code>DISCORD_APP_ID</code> variable.</li>
                        </ul>
                    </div>
                </section>

                {/* Step 2 */}
                <section className="space-y-4">
                    <h2 className="heading-display text-2xl font-bold text-parchment flex items-center gap-3">
                        <span className="border border-gold text-gold w-8 h-8 rounded-control flex items-center justify-center text-sm tabular-nums shrink-0">2</span>
                        Configure the Bot
                    </h2>
                    <div className="pl-11 space-y-4 text-parchment-2">
                        <p>Navigate to the <strong>Bot</strong> tab in the sidebar menu.</p>
                        <ul className="list-disc space-y-2 pl-4">
                            <li>Click <strong>Reset Token</strong> to generate your <code>DISCORD_BOT_TOKEN</code>. Copy it immediately.</li>
                                                        <li>Leave the privileged gateway intents (including &quot;Message Content Intent&quot;) turned off. The bot does not read messages, so it does not need them.</li>
                            <li>Ensure &quot;Public Bot&quot; is checked so you can easily invite it to servers.</li>
                        </ul>
                    </div>
                </section>

                {/* Step 3 */}
                <section className="space-y-4">
                    <h2 className="heading-display text-2xl font-bold text-parchment flex items-center gap-3">
                        <span className="border border-gold text-gold w-8 h-8 rounded-control flex items-center justify-center text-sm tabular-nums shrink-0">3</span>
                        Setup OAuth2 (Login)
                    </h2>
                    <div className="pl-11 space-y-4 text-parchment-2">
                        <p>This allows the <strong>&quot;Recover with Discord&quot;</strong> feature to work, letting you log in as the manager instantly.</p>
                        <ul className="list-disc space-y-2 pl-4">
                            <li>Go to the <strong>OAuth2</strong> tab.</li>
                            <li>Under &quot;Redirects&quot;, add your app&apos;s callback URL:
                                <code className="block mt-2 bg-field border border-line p-2 rounded-control text-parchment-2">https://your-domain.com/api/auth/discord/callback</code>
                            </li>
                            <li>Copy the <strong>Client Secret</strong>. This is your <code>DISCORD_CLIENT_SECRET</code>.</li>
                        </ul>
                    </div>
                </section>

                    {/* Step 4 */}
                    <section className="space-y-4">
                        <h2 className="heading-display text-2xl font-bold text-parchment flex items-center gap-3">
                            <span className="border border-gold text-gold w-8 h-8 rounded-control flex items-center justify-center text-sm tabular-nums shrink-0">4</span>
                            Configure Your Environment
                        </h2>
                        <div className="pl-11 space-y-4 text-parchment-2">
                            <p>Add the three values to your <code>docker-compose.yml</code> or <code>.env</code> file:</p>
                            <pre className="bg-field border border-line p-4 rounded-card text-parchment-2 text-sm overflow-x-auto"><code>{`DISCORD_BOT_TOKEN=your_bot_token
DISCORD_APP_ID=your_application_id
DISCORD_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_BASE_URL=https://your-domain.com`}</code></pre>
                            <p><code>NEXT_PUBLIC_BASE_URL</code> is required whenever a bot token is set, because every link the bot sends points at it. The app will not start without it.</p>
                        </div>
                    </section>

                    {/* Step 5 */}
                    <section className="space-y-4">
                        <h2 className="heading-display text-2xl font-bold text-parchment flex items-center gap-3">
                            <span className="border border-gold text-gold w-8 h-8 rounded-control flex items-center justify-center text-sm tabular-nums shrink-0">5</span>
                            Connect an Event
                        </h2>
                        <div className="pl-11 space-y-4 text-parchment-2">
                            <ul className="list-disc space-y-2 pl-4">
                                <li>Open the event&apos;s <strong>Manage</strong> page and click <strong>Connect Discord Server</strong>.</li>
                                <li>Discord asks you to pick a server and approve the bot. It requests View Channel, Send Messages, Manage Messages (to pin the dashboard), Embed Links and Read Message History.</li>
                                <li>You return to the Manage page. Pick the channel for event updates and click <strong>Save</strong>. Do this within an hour of adding the bot; after that, start again from <strong>Connect Discord Server</strong>.</li>
                                <li>The bot posts a short announcement with the event link and a live dashboard that it keeps up to date.</li>
                            </ul>
                        </div>
                    </section>

                    {/* Step 6 */}
                    <section className="space-y-4">
                        <h2 className="heading-display text-2xl font-bold text-parchment flex items-center gap-3">
                            <span className="border border-gold text-gold w-8 h-8 rounded-control flex items-center justify-center text-sm tabular-nums shrink-0">6</span>
                            What the Bot Sends
                        </h2>
                        <div className="pl-11 space-y-4 text-parchment-2">
                            <p>In the connected channel: the live dashboard, new or changed time slots, a short &quot;updated their availability&quot; post (at most once per person per hour), voting and session reminders if the organizer turns them on, the finalize announcement, and cancel or delete notices.</p>
                            <p>By direct message: login links you ask for, finalize results and waitlist or removal notices for events you joined with a linked Discord account, and quorum alerts to the organizer. Anyone can turn these direct messages off from <strong>My Events</strong>; login links you ask for are still sent.</p>
                        </div>
                    </section>

                {/* JSON-LD for AEO */}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(SchemaGenerator.howTo({
                            name: "How to Setup Discord Integration for TabletopTime",
                            description: "Learn how to create a Discord application, set up OAuth2, configure your environment, and connect an event to a channel.",
                            steps: [
                                {
                                    name: "Create Discord Application",
                                    text: "Create a new app in the Discord Developer Portal."
                                },
                                {
                                    name: "Create the Bot",
                                    text: "Generate the bot token in the Bot settings. No privileged intents are needed."
                                },
                                {
                                    name: "Configure OAuth2",
                                    text: "Add your callback URL and copy the Application ID and Client Secret to your environment variables, together with NEXT_PUBLIC_BASE_URL."
                                },
                                {
                                    name: "Connect an Event",
                                    text: "On the event's Manage page, click Connect Discord Server, add the bot to your server, then pick a channel within an hour."
                                }
                            ]
                        }))
                    }}
                />
            </div>
        </main>
    );
}

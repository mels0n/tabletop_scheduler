import type { Metadata } from 'next';
import { Bot, CheckCircle, ExternalLink, HelpCircle } from 'lucide-react';

export const metadata: Metadata = {
    title: 'How to Setup Discord Integration | TabletopTime',
    description: 'Learn how to connect a Discord Bot to TabletopTime for event notifications, pinned dashboards, and seamless login recovery.',
};

export default function DiscordSetupGuide() {
    return (
        <main className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12">
            <div className="max-w-3xl mx-auto space-y-12">

                {/* Header */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 text-indigo-400">
                        <Bot className="w-8 h-8" />
                        <span className="font-mono uppercase tracking-widest text-sm">Feature Guide</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold">Discord Integration Setup</h1>
                    <p className="text-xl text-slate-400 leading-relaxed">
                        Step-by-step instructions to creating a Discord Bot and connecting it to your self-hosted TabletopTime instance.
                    </p>
                </div>

                {/* Step 1 */}
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-slate-200 flex items-center gap-3">
                        <span className="bg-slate-800 text-slate-400 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                        Create a Discord Application
                    </h2>
                    <div className="pl-11 space-y-4 text-slate-400">
                        <p>
                            To get started, you need to create an application in the Discord Developer Portal.
                        </p>
                        <ul className="list-disc space-y-2 pl-4">
                            <li>Go to the <a href="https://discord.com/developers/applications" target="_blank" className="text-indigo-400 hover:underline inline-flex items-center gap-1">Developer Portal <ExternalLink className="w-3 h-3" /></a>.</li>
                            <li>Click <strong>New Application</strong> and give it a name (e.g., &quot;TabletopScheduler&quot;).</li>
                            <li>Copy the <strong>Application ID</strong>. You will need this for the <code>DISCORD_APP_ID</code> variable.</li>
                        </ul>
                    </div>
                </section>

                {/* Step 2 */}
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-slate-200 flex items-center gap-3">
                        <span className="bg-slate-800 text-slate-400 w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                        Configure the Bot
                    </h2>
                    <div className="pl-11 space-y-4 text-slate-400">
                        <p>Navigate to the <strong>Bot</strong> tab in the sidebar menu.</p>
                        <ul className="list-disc space-y-2 pl-4">
                            <li>Click <strong>Reset Token</strong> to generate your <code>DISCORD_BOT_TOKEN</code>. Copy it immediately.</li>
                            <li>Scroll down to &quot;Privileged Gateway Intents&quot;.</li>
                            <li><strong>Enable &quot;Message Content Intent&quot;</strong>. This is critical—the bot cannot function properly without it.</li>
                            <li>Ensure &quot;Public Bot&quot; is checked so you can easily invite it to servers.</li>
                        </ul>
                    </div>
                </section>

                {/* Step 3 */}
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-slate-200 flex items-center gap-3">
                        <span className="bg-slate-800 text-slate-400 w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
                        Setup OAuth2 (Login)
                    </h2>
                    <div className="pl-11 space-y-4 text-slate-400">
                        <p>This allows the <strong>&quot;Recover with Discord&quot;</strong> feature to work, letting you log in as the manager instantly.</p>
                        <ul className="list-disc space-y-2 pl-4">
                            <li>Go to the <strong>OAuth2</strong> tab.</li>
                            <li>Under &quot;Redirects&quot;, add your app&apos;s callback URL:
                                <code className="block mt-2 bg-slate-900 p-2 rounded text-slate-300">https://your-domain.com/api/auth/discord/callback</code>
                            </li>
                            <li>Copy the <strong>Client Secret</strong>. This is your <code>DISCORD_CLIENT_SECRET</code>.</li>
                        </ul>
                    </div>
                </section>

                {/* JSON-LD for AEO */}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "HowTo",
                            "name": "How to Setup Discord Integration for TabletopTime",
                            "step": [
                                {
                                    "@type": "HowToStep",
                                    "name": "Create Discord Application",
                                    "text": "Create a new app in the Discord Developer Portal."
                                },
                                {
                                    "@type": "HowToStep",
                                    "name": "Enable Intents",
                                    "text": "Enable Message Content Intent in the Bot settings."
                                },
                                {
                                    "@type": "HowToStep",
                                    "name": "Configure OAuth2",
                                    "text": "Add your callback URL and copy the Client ID and Secret to your environment variables."
                                }
                            ]
                        })
                    }}
                />
            </div>
        </main>
    );
}

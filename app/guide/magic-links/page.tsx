
import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Key, Smartphone, Lock, RefreshCw } from 'lucide-react';
import { SchemaGenerator } from '@/shared/lib/aeo';

export const metadata: Metadata = {
    title: 'Understanding Magic Links | Tabletop Time',
    description: 'Learn how Tabletop Time uses secure, passwordless Magic Links via Telegram and Discord to manage your identity and recover access to events.',
    alternates: {
        canonical: '/guide/magic-links',
    },
};

export default function MagicLinksPage() {
    const jsonLd = SchemaGenerator.article({
        headline: "Understanding Magic Links: Passwordless Auth for Tabletop Time",
        description: "How Tabletop Time uses secure links instead of passwords to keep your account safe and frictionless.",
        datePublished: new Date().toISOString() // Using current date as fallback, ideally should be static or from props
    });

    const breadcrumbsLd = SchemaGenerator.breadcrumb([
        { name: "Home", url: "/" },
        { name: "Magic Links Guide", url: "/guide/magic-links" }
    ]);

    return (
        <main className="min-h-screen bg-slate-950 text-slate-50 py-12 px-4 md:px-8">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsLd) }}
            />

            <div className="max-w-3xl mx-auto">
                <Link href="/" className="inline-flex items-center text-indigo-400 hover:text-indigo-300 mb-8 transition-colors group">
                    <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                    Back to Home
                </Link>

                <article className="prose prose-invert prose-lg max-w-none prose-headings:text-indigo-100 prose-a:text-indigo-400 hover:prose-a:text-indigo-300 prose-strong:text-slate-100">
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-6">
                        Understanding Magic Links
                    </h1>

                    <p className="lead text-xl text-slate-400 mb-8">
                        Tabletop Time uses a <strong>passwordless</strong> authentication system. Instead of usernames and passwords, we use secure &quot;Magic Links&quot; sent to your Telegram or Discord to verify your identity.
                    </p>

                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-10 not-prose">
                        <h3 className="text-lg font-semibold text-indigo-400 mb-2 flex items-center gap-2">
                            <Lock className="w-5 h-5" /> Why no passwords?
                        </h3>
                        <p className="text-slate-300">
                            We believe you shouldn&apos;t need another password for a tool you use once a week. By verifying ownership of your Telegram/Discord account, we can prove it&apos;s you without storing sensitive credentials.
                        </p>
                    </div>

                    <h2>Use Case 1: Sync & Recover (My Events)</h2>
                    <p className="italic text-slate-400">Best for: Logging in to view all your events at once.</p>

                    <p>
                        If you are on a new device or your cookies have been cleared, you can recover access to your entire event history via the <strong>My Events</strong> (Profile) page.
                    </p>
                    <ol>
                        <li>Navigate to the <Link href="/profile">My Events</Link> page.</li>
                        <li>Scroll down to the <strong>&quot;Sync & Recover&quot;</strong> section.</li>
                        <li>Enter your <strong>Telegram Handle</strong> (e.g., <code>@YourHandle</code>) or Discord Username.</li>
                        <li>Click <strong>Sync My Events</strong>.</li>
                        <li>The bot will DM you a <strong>Global Magic Link</strong>. Click it to log in.</li>
                    </ol>
                    <p>
                        This will restore your <strong>Event List</strong> and your <strong>Voting Identity</strong> (allowing you to edit previous votes).
                    </p>

                    <hr className="my-8 border-slate-800" />

                    <h2>Use Case 2: Manager Recovery</h2>
                    <p className="italic text-slate-400">Best for: Quickly switching devices for a specific event.</p>

                    <p>
                        Viewing your event&apos;s Manage Page and want to switch to your phone?
                    </p>
                    <ol>
                        <li>On the Manage Page, look for the <strong>Manager Recovery</strong> box.</li>
                        <li>Click <strong>&quot;Send Magic Link&quot;</strong>.</li>
                        <li>The bot will send a specific <strong>Event Admin Link</strong> to your DMs.</li>
                        <li>Clicking this grants admin access <em>only</em> for that specific event.</li>
                    </ol>

                    <hr className="my-8 border-slate-800" />

                    <h2>Use Case 3: I&apos;m Locked Out</h2>
                    <p className="italic text-slate-400">Best for: Recovering access when cookies are gone.</p>

                    <p>
                        If you are viewing an event you created but appear as a <em>Participant</em> (no admin controls):
                    </p>
                    <ol>
                        <li>Scroll to the bottom of the Vote Page.</li>
                        <li>Click: <strong>&quot;Are you the organizer? Manage this event&quot;</strong>.</li>
                        <li>Click the small link: <strong>&quot;Lost Manager Link?&quot;</strong>.</li>
                        <li>Enter your Telegram Handle.</li>
                        <li>If it matches our records, we send a secure link to your DMs.</li>
                    </ol>

                    <div className="bg-indigo-900/20 border-l-4 border-indigo-500 p-4 rounded-r-lg mt-8 not-prose">
                        <h4 className="font-bold text-indigo-300 flex items-center gap-2 mb-1">
                            <RefreshCw className="w-4 h-4" /> Technical Insight
                        </h4>
                        <p className="text-sm text-slate-300">
                            We use two layers of storage: <strong>Cookies</strong> (for secure, 30-day server auth) and <strong>LocalStorage</strong> (to auto-fill your name and remember your specific votes on a device). Magic Links restore <em>both</em>.
                        </p>
                    </div>

                </article>
            </div>
        </main>
    );
}

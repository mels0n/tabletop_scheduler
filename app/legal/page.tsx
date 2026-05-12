import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Legal — Terms of Service & Privacy Policy',
    description: 'Terms of Service and Formal Privacy Disclosures for Tabletop Time. Learn about our policies for using the free, open-source game scheduling tool.',
    alternates: {
        canonical: '/legal',
    },
};

export default function LegalPage() {
    const isHosted = process.env.NEXT_PUBLIC_IS_HOSTED === "true";

    if (!isHosted) {
        return (
            <main className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12">
                <div className="max-w-4xl mx-auto text-center space-y-8">
                    <h1 className="text-4xl font-bold text-slate-200">Legal Information</h1>
                    <p className="text-xl text-slate-400">
                        This page is only available on the hosted version of Tabletop Time.
                    </p>
                    <Link href="/" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                        &larr; Back to Scheduler
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12">
            <div className="max-w-4xl mx-auto space-y-16">

                {/* Header */}
                <div className="space-y-6 text-center">
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-slate-200 to-slate-400 bg-clip-text text-transparent">
                        Legal
                    </h1>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                        Terms of Service and Formal Privacy Disclosures for Tabletop Time.
                    </p>
                </div>

                {/* Terms of Service */}
                <section className="space-y-8">
                    <h2 className="text-3xl font-bold text-slate-200 border-b border-slate-800 pb-4">
                        Terms of Service
                    </h2>
                    <p className="text-sm text-slate-500">Last Updated: May 1, 2026</p>

                    <div className="prose prose-invert max-w-none space-y-6">
                        <p className="text-slate-300 leading-relaxed">
                            Welcome to Tabletop Time. By using this service, you agree to these basic terms. If you disagree with them, please do not use the site.
                        </p>

                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-slate-200">1. The Service is Provided &quot;As-Is&quot;</h3>
                            <p className="text-slate-300 leading-relaxed">
                                Tabletop Time is a free, personal project. While we strive to keep the service fast and reliable, we do not guarantee 100% uptime. The service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind. We reserve the right to modify, suspend, or shut down the service at any time without notice.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-slate-200">2. Acceptable Use</h3>
                            <p className="text-slate-300 leading-relaxed">
                                This tool is built to help people schedule games. You agree not to:
                            </p>
                            <ul className="list-disc list-inside text-slate-300 space-y-2 ml-4">
                                <li>Use the service for any illegal purposes.</li>
                                <li>Spam the system with automated bots or generate a volume of events that degrades server performance for others.</li>
                                <li>Include malicious links, hateful content, or illegal material in your event titles or descriptions.</li>
                                <li>Attempt to reverse-engineer or compromise the security of the hosting infrastructure.</li>
                            </ul>
                            <p className="text-slate-300 leading-relaxed">
                                We reserve the right to block IPs or delete events that violate these rules or threaten the stability of the platform.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-slate-200">3. Donations</h3>
                            <p className="text-slate-300 leading-relaxed">
                                If you choose to support Tabletop Time via Ko-fi, we are incredibly grateful. Please note that donations are entirely voluntary gifts to help cover server and development costs. They do not constitute a purchase of goods, premium services, or service-level agreements (SLAs), and are non-refundable.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-slate-200">4. Open Source &amp; Self-Hosting</h3>
                            <p className="text-slate-300 leading-relaxed">
                                The code for Tabletop Time is open source and available on our GitHub repository. If you choose to deploy your own self-hosted instance using our Docker image, you are solely responsible for its operation, security, and legal compliance. We provide no official support or warranties for self-hosted instances.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-slate-200">5. Limitation of Liability</h3>
                            <p className="text-slate-300 leading-relaxed">
                                To the maximum extent permitted by law, Christopher Melson and Tabletop Time shall not be liable for any direct, indirect, incidental, or consequential damages resulting from your use of the service. If a server glitch deletes your event and your group misses out on a game of Root or a Magic draft, we apologize for the inconvenience, but we are not legally or financially liable.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-slate-200">6. Changes to These Terms</h3>
                            <p className="text-slate-300 leading-relaxed">
                                We may update these terms occasionally to reflect changes in the project. Continued use of the site after updates constitutes acceptance of the new terms.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Formal Privacy Disclosures */}
                <section className="space-y-8">
                    <h2 className="text-3xl font-bold text-slate-200 border-b border-slate-800 pb-4">
                        Formal Privacy Disclosures
                    </h2>
                    <p className="text-sm text-slate-500">Last Updated: May 1, 2026</p>

                    <div className="prose prose-invert max-w-none space-y-6">
                        <p className="text-slate-300 leading-relaxed">
                            Tabletop Time is a free, open-source personal project built by Christopher Melson. While we operate on a &quot;Zero Tracking&quot; philosophy, here are the technical realities of how data is processed:
                        </p>

                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-slate-200">Data We Collect</h3>
                            <p className="text-slate-300 leading-relaxed">
                                We only store the data you explicitly provide to make the app work: proposed event times, display names, and availability votes.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-slate-200">Donation Records &amp; Public Shoutouts</h3>
                            <p className="text-slate-300 leading-relaxed">
                                If you generously choose to support the project financially via Ko-fi, you control what is shared. If you make a &quot;public&quot; donation, we store your provided name, transaction ID, amount, and message, and proudly display your name and message on our homepage ticker to thank you. If you mark your donation as &quot;private&quot; on Ko-fi, our system simply drops the webhook data and we do not store your record in our database at all. Unlike event data, public donation records are retained long-term and are not subject to the automated server purge.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-slate-200">Server Logs</h3>
                            <p className="text-slate-300 leading-relaxed">
                                Like almost all websites, our hosting infrastructure temporarily logs standard request data (such as IP addresses and browser types) solely for security, performance monitoring, and DDOS prevention.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-slate-200">Optional Integrations</h3>
                            <p className="text-slate-300 leading-relaxed">
                                If you choose to link Discord or Telegram for session recovery, we receive basic authentication tokens from those services. We do not pull your friend lists, message history, or other profile data.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-slate-200">Data Rights &amp; Contact</h3>
                            <p className="text-slate-300 leading-relaxed">
                                Because we do not use accounts, we cannot verify your identity to process manual data deletion requests for event sessions. To remove session data, either ask your Event Host to delete the event, or wait for the automated 24-hour server purge. For general policy questions, please open an issue on our GitHub Repository.
                            </p>
                        </div>
                    </div>
                </section>

                <div className="text-center pt-12 border-t border-slate-800">
                    <Link href="/" className="text-slate-500 hover:text-slate-300 transition-colors">
                        &larr; Back to Scheduler
                    </Link>
                </div>

            </div>
        </main>
    );
}
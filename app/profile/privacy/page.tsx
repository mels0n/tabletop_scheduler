import { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { LinkedAccountsPanel } from "@/features/auth/ui/LinkedAccountsPanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Privacy & Data",
    robots: "noindex, nofollow",
};

/**
 * @function ProfilePrivacyPage
 * @description Dedicated privacy opt-out page for account-level data controls, split off
 * from the profile dashboard so the destructive "unlink and delete my data" action can't
 * be confused with the browser-level connect/disconnect pills or per-event link/unlink.
 * This page is the self-serve deletion path that the /privacy and /legal copy (and
 * Discord's Developer ToS deletion requirement) point users at.
 *
 * Reads the same httpOnly platform cookies as the profile page to decide which platforms
 * are currently linked on this browser.
 */
export default function ProfilePrivacyPage() {
    const cookieStore = cookies();
    const isTelegramSynced = !!cookieStore.get("tabletop_user_chat_id")?.value;
    const isDiscordSynced = !!cookieStore.get("tabletop_user_discord_id")?.value;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12">
            <div className="max-w-3xl mx-auto space-y-8">
                <Link href="/profile" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors mb-4">
                    <ArrowLeft className="w-4 h-4" /> Back to My Events
                </Link>

                {/* No bottom border here: LinkedAccountsPanel brings its own top border. */}
                <div>
                    <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
                        <ShieldCheck className="w-7 h-7 text-indigo-400" />
                        Privacy &amp; Data
                    </h1>
                    <p className="text-slate-400 mt-2 max-w-xl">
                        Account-level controls for the data Tabletop Time stores about your linked
                        platforms. Looking to just sign this browser out of Telegram or Discord sync,
                        or to link and unlink individual events? Both of those live on your{" "}
                        <Link href="/profile" className="text-indigo-400 hover:text-indigo-300 underline">
                            My Events
                        </Link>{" "}
                        page and don&apos;t delete anything.
                    </p>
                </div>

                <LinkedAccountsPanel isTelegramSynced={isTelegramSynced} isDiscordSynced={isDiscordSynced} />

                <p className="text-xs text-slate-600">
                    Event data itself is purged automatically after events end. See our{" "}
                    <Link href="/privacy" className="text-slate-500 hover:text-slate-300 underline">
                        privacy overview
                    </Link>{" "}
                    for details on what is stored and for how long.
                </p>
            </div>
        </div>
    );
}

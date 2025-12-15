"use client";

import { useState, useEffect } from "react";
import { CopyLinkButton } from "./CopyLinkButton";
import { updateTelegramInviteLink, checkEventStatus } from "@/app/actions";
import { AlertCircle, CheckCircle, HelpCircle, Loader2, Save, Send } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * @interface TelegramConnectProps
 * @description Props for the TelegramConnect component.
 * @property {string} slug - The event slug.
 * @property {string} botUsername - The bot's username (for deep linking).
 * @property {string | null} [initialTelegramLink] - Existing invite link if already saved.
 * @property {boolean} hasChatId - Whether the event is already fully connected to a group.
 */
interface TelegramConnectProps {
    slug: string;
    botUsername: string;
    initialTelegramLink?: string | null;
    hasChatId: boolean;
}

/**
 * @component TelegramConnect
 * @description A multi-step wizard to guide users through connecting their Event to a Telegram Group.
 * It handles:
 * 1. Verifying if the bot is already in the group.
 * 2. Providing the correct Deep Link or Webhook Payload to link the group.
 * 3. Capturing and saving the Group Invite Link for user convenience.
 * 4. Polling for successful connection status.
 *
 * @param {TelegramConnectProps} props - Component props.
 * @returns {JSX.Element} The connection wizard UI.
 */
export function TelegramConnect({ slug, botUsername, initialTelegramLink, hasChatId: initialHasChatId }: TelegramConnectProps) {
    const router = useRouter();
    const [telegramLink, setTelegramLink] = useState(initialTelegramLink || "");
    const [hasChatId, setHasChatId] = useState(initialHasChatId);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    // Intent: Define wizard steps for the connection flow.
    // 'initial': Asking if bot is in group
    // 'bot_not_in_group': User said No
    // 'bot_in_group': User said Yes (Show copy link)
    // 'link_saved': Link was just saved, ready to add bot
    const [step, setStep] = useState<'initial' | 'bot_not_in_group' | 'bot_in_group' | 'link_saved'>('initial');

    // Intent: Poll for status update when not connected to provide real-time feedback.
    useEffect(() => {
        if (hasChatId) return;

        const interval = setInterval(async () => {
            try {
                const status = await checkEventStatus(slug);
                if (status.hasTelegramChatId) {
                    setHasChatId(true);
                    router.refresh(); // Intent: Sync server components (like the "Danger Zone" which might change).
                }
            } catch (e) {
                // ignore errors during background polling
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [hasChatId, slug, router]);

    /**
     * persistent storage of the user-provided Telegram Invite Link.
     * This is useful for displaying the link to participants later.
     */
    const handleSaveLink = async () => {
        if (!telegramLink) return;
        setIsSaving(true);
        setError("");

        try {
            const res = await updateTelegramInviteLink(slug, telegramLink);
            if (res.error) {
                setError(res.error);
            } else {
                setStep('link_saved');
                router.refresh();
            }
        } catch (e) {
            setError("Failed to save link.");
        } finally {
            setIsSaving(false);
        }
    };

    // State: Fully Connected
    if (hasChatId) {
        return (
            <div className="p-4 bg-green-900/20 border border-green-800 rounded-xl text-sm text-green-300 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <div>
                    <p className="font-bold">Telegram Connected</p>
                    <p className="opacity-80 text-xs">This event is linked to a Telegram group.</p>
                </div>
            </div>
        );
    }

    // State: Setup Wizard
    return (
        <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-xl space-y-4">
            <div className="flex items-start gap-3 text-blue-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="font-bold">Connect Telegram Notifications</p>
                    <p className="opacity-90 text-xs">
                        {step === 'bot_in_group' && "Great! Just one more step."}
                        {step === 'bot_not_in_group' && "Okay, let's get set up."}
                        {step === 'link_saved' && "Link Saved! Now add the bot."}
                    </p>
                </div>
            </div>

            {/* Step 1: Initial Question */}
            {step === 'initial' && (
                <div className="space-y-3 pl-8">
                    <p className="text-sm text-slate-300">
                        Is <b>@{botUsername}</b> already in the Telegram group you want to link?
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setStep('bot_in_group')}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors"
                        >
                            Yes, it is
                        </button>
                        <button
                            onClick={() => setStep(telegramLink ? 'link_saved' : 'bot_not_in_group')}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            No, not yet
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: Bot IS in group -> Paste Link */}
            {step === 'bot_in_group' && (
                <div className="space-y-4 pl-8 animate-in fade-in slide-in-from-top-2">
                    <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700 space-y-2">
                        <p className="text-xs text-slate-400">
                            1. Copy this specific event link:
                        </p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 bg-black/30 p-2 rounded text-xs font-mono text-slate-300 truncate">
                                {/* Intent: Ensure correct origin is displayed whether SSR or Client */}
                                {typeof window !== 'undefined' ? `${window.location.host}/e/${slug}` : `/e/${slug}`}
                            </code>
                            <div className="shrink-0">
                                <CopyLinkButton url={`/e/${slug}`} />
                            </div>
                        </div>
                        <p className="text-xs text-slate-400">
                            2. <b>Paste it into your Telegram group</b> to finish connecting.
                        </p>
                    </div>
                    <button
                        onClick={() => setStep('initial')}
                        className="text-xs text-slate-500 hover:text-slate-300 underline"
                    >
                        Start Over
                    </button>
                </div>
            )}

            {/* Step 3: Bot NOT in group -> Need Link */}
            {step === 'bot_not_in_group' && (
                <div className="space-y-4 pl-8 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                        <label className="text-sm text-slate-300 font-medium">
                            First, what is the Group Invite Link?
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="url"
                                placeholder="https://t.me/..."
                                value={telegramLink}
                                onChange={(e) => setTelegramLink(e.target.value)}
                                className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                            />
                            <button
                                onClick={handleSaveLink}
                                disabled={isSaving || !telegramLink.startsWith('https://t.me/')}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save
                            </button>
                        </div>
                        {error && <p className="text-red-400 text-xs">{error}</p>}

                        <details className="text-xs text-slate-400 cursor-pointer">
                            <summary className="hover:text-slate-300">How to find this?</summary>
                            <ol className="list-decimal pl-5 mt-2 space-y-1 text-slate-500">
                                <li>Open Group Info in Telegram</li>
                                <li>Tap &quot;Add Members&quot;</li>
                                <li>Tap &quot;Invite to Group via Link&quot;</li>
                                <li>Copy Link</li>
                            </ol>
                        </details>
                    </div>
                    <button
                        onClick={() => setStep('initial')}
                        className="text-xs text-slate-500 hover:text-slate-300 underline"
                    >
                        Back
                    </button>
                </div>
            )}

            {/* Step 4: Link Saved -> Add Bot Button */}
            {step === 'link_saved' && (
                <div className="space-y-4 pl-8 animate-in fade-in slide-in-from-top-2">
                    <p className="text-sm text-slate-300">
                        Perfect. Now click below to add the bot to your group.
                    </p>
                    <a
                        href={`https://t.me/${botUsername}?startgroup=${slug}&admin=change_info+pin_messages`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                    >
                        <Send className="w-4 h-4" />
                        <span>Add @{botUsername} to Group</span>
                    </a>
                    <p className="text-xs text-slate-500 text-center">
                        (You&apos;ll need to give it Admin rights to Pin Messages)
                    </p>
                    <button
                        onClick={() => setStep('initial')}
                        className="text-xs text-slate-500 hover:text-slate-300 underline"
                    >
                        Back
                    </button>
                </div>
            )}
        </div>
    );
}

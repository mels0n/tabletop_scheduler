"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { linkParticipant } from "@/features/auth/server/participant-link";

interface ParticipantLinkInfo {
    id: number;
    hasTelegramLink: boolean;
    hasDiscordLink: boolean;
}

interface Props {
    eventId: number;
    slug: string;
    isTelegramSynced: boolean;
    isDiscordSynced: boolean;
    participants: ParticipantLinkInfo[];
}

/**
 * @component EventLinkBanner
 * @description Slim dismissible banner offering to link the current browser's synced
 * identity (Telegram/Discord cookie) to the local participant row for this event, so
 * the event shows up on the user's profile across devices.
 *
 * Only shown when all of the following hold:
 * - the browser is synced with a platform (`isTelegramSynced`/`isDiscordSynced`, from
 *   the server-read cookie)
 * - the client has a `tabletop_participant_<eventId>` entry in localStorage
 * - that participant row isn't already linked for the synced platform(s)
 *
 * Dismiss is session-level only (component state, not persisted).
 */
export function EventLinkBanner({ eventId, slug, isTelegramSynced, isDiscordSynced, participants }: Props) {
    const router = useRouter();
    const [dismissed, setDismissed] = useState(false);
    const [participantId, setParticipantId] = useState<number | null>(null);
    const [pending, setPending] = useState<"telegram" | "discord" | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem(`tabletop_participant_${eventId}`);
        if (saved) setParticipantId(parseInt(saved));
    }, [eventId]);

    if (dismissed || !participantId) return null;

    const participant = participants.find(p => p.id === participantId);
    if (!participant) return null;

    const offerTelegram = isTelegramSynced && !participant.hasTelegramLink;
    const offerDiscord = isDiscordSynced && !participant.hasDiscordLink;

    if (!offerTelegram && !offerDiscord) return null;

    const platforms = [offerTelegram && "Telegram", offerDiscord && "Discord"].filter(Boolean).join(" and ");

    const handleLink = (platform: "telegram" | "discord") => async () => {
        setPending(platform);
        setMessage(null);
        const res = await linkParticipant({ slug, participantId, platform });
        setPending(null);
        if ("error" in res) {
            setMessage({ type: "error", text: res.error });
        } else {
            setMessage({ type: "success", text: res.message || "Linked." });
            router.refresh();
        }
    };

    return (
        <div className="flex items-start gap-3 bg-indigo-950/50 border border-indigo-800/50 rounded-lg p-3 text-sm">
            <div className="flex-1 space-y-2 text-indigo-200">
                <p>
                    This browser is synced with {platforms}. Link this event so it shows on all your devices?
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    {offerTelegram && (
                        <button
                            type="button"
                            onClick={handleLink("telegram")}
                            disabled={pending === "telegram"}
                            className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded transition-colors"
                        >
                            {pending === "telegram" ? "Linking…" : "Link Telegram"}
                        </button>
                    )}
                    {offerDiscord && (
                        <button
                            type="button"
                            onClick={handleLink("discord")}
                            disabled={pending === "discord"}
                            className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded transition-colors"
                        >
                            {pending === "discord" ? "Linking…" : "Link Discord"}
                        </button>
                    )}
                </div>
                {message && (
                    <p className={message.type === "success" ? "text-green-400 text-xs" : "text-amber-400 text-xs"}>
                        {message.text}
                    </p>
                )}
            </div>
            <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setDismissed(true)}
                className="text-indigo-400 hover:text-indigo-300 transition-colors shrink-0"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

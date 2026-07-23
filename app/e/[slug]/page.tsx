import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata, ResolvingMetadata } from "next";
import prisma from "@/shared/lib/prisma";
import { HistoryTracker } from "@/components/HistoryTracker";
import { Calendar, Users } from "lucide-react";
import { ManagerRecovery } from "@/features/auth/ui/ManagerRecovery";
import { VotingInterface } from "@/components/VotingInterface";
import { FinalizedEventView } from "@/components/FinalizedEventView";
import { CampaignStatusBanner } from "@/components/CampaignStatusBanner";
import { EventLinkBanner } from "@/components/EventLinkBanner";
import Link from "next/link";
import { ClientDate, ClientTimezone } from "@/components/ClientDate";

interface PageProps {
    params: { slug: string };
    searchParams: { action?: string };
}

/**
 * @function generateMetadata
 * @description Generates dynamic metadata for the event page.
 */
export async function generateMetadata(
    { params }: PageProps,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const event = await getEvent(params.slug);

    if (!event) {
        return {
            title: "Event Not Found",
            description: "The requested event could not be found.",
        };
    }

    return {
        title: event.title,
        description: event.description || "Coordinate D&D and board game sessions without the chaos.",
        openGraph: {
            title: event.title,
            description: event.description || "Coordinate D&D and board game sessions without the chaos.",
            type: "website",
        },
        twitter: {
            card: "summary_large_image",
            title: event.title,
            description: event.description || "Coordinate D&D and board game sessions without the chaos.",
        },
    };
}

/**
 * @function getEvent
 * @description Fetches the event and relations for the Public Player View.
 *
 * Data Requirements:
 * - TimeSlots & Votes: To display current options and who has voted.
 * - Participants: To identify if the current user (via cookie) has already voted.
 * - FinalizedHost: For the confirmed event display.
 *
 * @param {string} slug - The event identifier.
 */
async function getEvent(slug: string) {
    const event = await prisma.event.findUnique({
        where: { slug },
        include: {
            timeSlots: {
                include: {
                    votes: {
                        include: {
                            participant: true
                        }
                    }
                },
                orderBy: { startTime: 'asc' }
            },
            participants: true,
            finalizedHost: true,
            finalizedSessions: {
                include: {
                    timeSlot: true
                },
                orderBy: { createdAt: 'asc' }
            },
        },
    });

    return event;
}

/**
 * @component EventPage
 * @description The main public-facing page for an event.
 *
 * Capabilities:
 * 1. User Identification:
 *    - checks `tabletop_user_chat_id` cookie to auto-detect if the visitor is a known participant.
 * 2. State Routing:
 *    - Renders `FinalizedEventView` (Read-only status card) if status is FINALIZED.
 *    - Renders `VotingInterface` (Interactive slots) if status is DRAFT/VOTING.
 *    - Renders "Cancelled" card if status is CANCELLED.
 * 3. Management Link:
 *    - Provides a link to `/manage` for the organizer.
 *    - Includes `ManagerRecovery` tool for lost access.
 */
export default async function EventPage({ params, searchParams }: PageProps) {
    const event = await getEvent(params.slug);

    // Intent: Identify user from server-side cookie (Fail-safe for cross-browser sync).
    // This allows the voting interface to pre-fill "You are interacting as X".
    const cookieStore = cookies();
    const userChatId = cookieStore.get("tabletop_user_chat_id")?.value;
    const userDiscordId = cookieStore.get("tabletop_user_discord_id")?.value;
    const isTelegramSynced = !!userChatId;
    const isDiscordSynced = !!userDiscordId;

    let serverParticipantId: number | undefined;
    if (event?.participants) {
        // Priority 1: Telegram chatId (set by bot after /start flow)
        if (userChatId) {
            const found = event.participants.find(p => p.chatId === userChatId);
            if (found) serverParticipantId = found.id;
        }
        // Priority 2: Discord user ID (set by Discord OAuth cookie) — mirrors Telegram behaviour
        if (!serverParticipantId && userDiscordId) {
            const found = event.participants.find(p => p.discordId === userDiscordId);
            if (found) serverParticipantId = found.id;
        }
    }

    if (!event) {
        notFound();
    }

    // Optimization: Pre-calculate counts server-side to reduce client processing.
    const slotsWithCounts = event.timeSlots.map(slot => {
        const yes = slot.votes.filter(v => v.preference === 'YES').length;
        const maybe = slot.votes.filter(v => v.preference === 'MAYBE').length;
        const no = slot.votes.filter(v => v.preference === 'NO').length;
        return { ...slot, counts: { yes, maybe, no } };
    });

    // Feature: Event-page link banner. Expose only linked/unlinked booleans to the
    // client, never the raw chatId/discordId values.
    const participantLinkInfo = event.participants.map(p => ({
        id: p.id,
        hasTelegramLink: !!p.chatId,
        hasDiscordLink: !!p.discordId,
    }));

    // Determine finalized slot/sessions if applicable
    const isFinalized = event.status === 'FINALIZED';
    const isCampaignFinalized = isFinalized && event.eventType === 'CAMPAIGN' && event.finalizedSessions.length > 0;
    const isOneShotFinalized = isFinalized && event.finalizedSlotId;
    const finalizedSlot = isOneShotFinalized ? event.timeSlots.find(s => s.id === event.finalizedSlotId) : null;

    return (
        <main className="min-h-screen bg-slate-950 text-slate-50 p-4 md:p-8">
            <HistoryTracker slug={event.slug} title={event.title} />
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Header Section */}
                <div className="space-y-4 border-b border-slate-800 pb-6">
                    <div className="flex items-center gap-3 text-indigo-400 mb-2">
                        <Calendar className="w-5 h-5" />
                        <span className="font-mono text-sm uppercase tracking-wider">Scheduling Event</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                            {event.title}
                        </h1>
                        {event.eventType === "CAMPAIGN" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-950 border border-indigo-700/60 text-indigo-300 text-xs font-semibold uppercase tracking-wider shrink-0">
                                <Calendar className="w-3 h-3" />
                                Campaign
                            </span>
                        )}
                    </div>

                    {event.description && (
                        <p className="text-lg text-slate-400 max-w-2xl leading-relaxed">
                            {event.description}
                        </p>
                    )}

                    {event.telegramLink && (
                        <div className="pt-2">
                            <a
                                href={event.telegramLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 rounded-lg border border-sky-600/50 transition-colors font-medium text-sm"
                            >
                                <Users className="w-4 h-4" />
                                Join Telegram Chat
                            </a>
                        </div>
                    )}

                    <div className="flex items-center gap-2 text-slate-500 text-sm mt-4">
                        <Users className="w-4 h-4" />
                        <span>Target: {event.minPlayers} players needed</span>
                    </div>
                </div>

                {event.status !== 'CANCELLED' && (
                    <EventLinkBanner
                        eventId={event.id}
                        slug={event.slug}
                        isTelegramSynced={isTelegramSynced}
                        isDiscordSynced={isDiscordSynced}
                        participants={participantLinkInfo}
                    />
                )}

                {/* Voting or Finalized View */}
                {/* Status Views Routing */}
                {event.status === 'CANCELLED' ? (
                    <div className="p-8 rounded-2xl bg-slate-900 border border-red-900/50 text-center space-y-6">
                        <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">🚫</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-red-500 mb-2">Event Cancelled</h2>
                            <p className="text-slate-400 text-lg max-w-lg mx-auto">
                                The organizer has cancelled this event.
                                <br />
                                No further voting or actions are allowed.
                            </p>
                        </div>
                        <div className="pt-4 border-t border-slate-800/50">
                            <Link href="/" className="text-slate-500 hover:text-slate-300 transition-colors text-sm underline">
                                Return to Home
                            </Link>
                        </div>
                    </div>
                ) : isCampaignFinalized ? (
                    (() => {
                        return (
                            <div className="space-y-4">
                                {/* Personal status banner — reads localStorage so works for all browser-identified voters */}
                                <CampaignStatusBanner
                                    eventId={event.id}
                                    acceptedIds={event.participants.filter((p: any) => p.status === 'ACCEPTED').map((p: any) => p.id)}
                                    waitlistIds={event.participants.filter((p: any) => p.status === 'WAITLIST').map((p: any) => p.id)}
                                    serverParticipantId={serverParticipantId}
                                />

                                <div className="bg-gradient-to-br from-indigo-900/20 to-slate-900 border border-indigo-800/50 rounded-2xl p-6 md:p-8 space-y-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white mb-1">Campaign Sessions Locked In!</h2>
                                        <p className="text-indigo-300 text-sm">{event.finalizedSessions.length} session{event.finalizedSessions.length !== 1 ? 's' : ''} scheduled</p>
                                    </div>
                                    <div className="space-y-2">
                                        {event.finalizedSessions.map((session: any, index: number) => {
                                            return (
                                                <div key={session.id} className="bg-slate-950/50 rounded-xl p-3 flex items-center gap-3 border border-slate-800">
                                                    <div className="w-7 h-7 rounded-full bg-indigo-900/50 flex items-center justify-center text-indigo-300 font-bold text-xs shrink-0">
                                                        {index + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-semibold text-slate-200 text-sm">
                                                            <ClientDate date={session.timeSlot.startTime} formatStr="EEEE, MMMM do, yyyy" />
                                                        </div>
                                                        <div className="text-xs text-indigo-300">
                                                            <ClientDate date={session.timeSlot.startTime} formatStr="h:mm a" /> – <ClientDate date={session.timeSlot.endTime} formatStr="h:mm a" />
                                                            <ClientTimezone className="ml-1 text-indigo-300/70" />
                                                        </div>
                                                    </div>
                                                    <a
                                                        href={`/api/event/${event.slug}/ics?slot=${session.timeSlot.id}`}
                                                        title="Download this session (.ics)"
                                                        className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-colors shrink-0"
                                                    >
                                                        📎 .ics
                                                    </a>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {event.location && (
                                        <div className="flex items-center gap-2 text-slate-400 text-sm border-t border-slate-700/50 pt-4">
                                            <Calendar className="w-4 h-4 text-indigo-400" />
                                            <span>{event.location}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Campaign group — always public */}
                                {(() => {
                                    const acceptedPlayers = event.participants.filter((p: any) => p.status === 'ACCEPTED');
                                    const waitlistPlayers = event.participants.filter((p: any) => p.status === 'WAITLIST');
                                    if (acceptedPlayers.length === 0) return null;
                                    return (
                                        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5 space-y-4">
                                            <div>
                                                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Campaign Group</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {acceptedPlayers.map((p: any) => (
                                                        <span
                                                            key={p.id}
                                                            className={`text-sm px-3 py-1 rounded-full border font-medium ${
                                                                p.id === serverParticipantId
                                                                    ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-200'
                                                                    : 'bg-slate-800 border-slate-700 text-slate-300'
                                                            }`}
                                                        >
                                                            {p.id === serverParticipantId ? `${p.name} (you)` : p.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            {waitlistPlayers.length > 0 && (
                                                <div className="border-t border-slate-800 pt-4">
                                                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Subs / Waitlist</h3>
                                                    <div className="flex flex-wrap gap-2">
                                                        {waitlistPlayers.map((p: any) => (
                                                            <span
                                                                key={p.id}
                                                                className={`text-sm px-3 py-1 rounded-full border font-medium opacity-60 ${
                                                                    p.id === serverParticipantId
                                                                        ? 'bg-yellow-900/20 border-yellow-700/50 text-yellow-300'
                                                                        : 'bg-slate-800/50 border-slate-700 text-slate-400'
                                                                }`}
                                                            >
                                                                {p.id === serverParticipantId ? `${p.name} (you)` : p.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        );
                    })()
                ) : isOneShotFinalized && finalizedSlot ? (
                    <FinalizedEventView
                        event={event}
                        finalizedSlot={finalizedSlot}
                        serverParticipantId={serverParticipantId}
                        discordIdentity={cookieStore.get("tabletop_user_discord_id")?.value ? {
                            id: cookieStore.get("tabletop_user_discord_id")!.value,
                            username: cookieStore.get("tabletop_user_discord_name")?.value || "Discord User"
                        } : undefined}
                    />
                ) : (
                    <VotingInterface
                        eventId={event.id}
                        initialSlots={slotsWithCounts}
                        participants={event.participants}
                        minPlayers={event.minPlayers}
                        slug={event.slug}
                        serverParticipantId={serverParticipantId}
                        eventType={event.eventType as "ONE_SHOT" | "CAMPAIGN"}
                        discordIdentity={cookieStore.get("tabletop_user_discord_id")?.value ? {
                            id: cookieStore.get("tabletop_user_discord_id")!.value,
                            username: cookieStore.get("tabletop_user_discord_name")?.value || "Discord User"
                        } : undefined}
                    />
                )}

                <div className="text-center pt-8 border-t border-slate-800">
                    <p className="text-slate-500 text-sm mb-2">Are you the organizer?</p>
                    <Link
                        href={`/e/${event.slug}/manage`}
                        className="text-indigo-400 hover:text-indigo-300 underline text-sm transition-colors"
                    >
                        Manage Event & Finalize Time
                    </Link>
                </div>

                <ManagerRecovery slug={event.slug} defaultOpen={searchParams.action === 'login'} />

            </div>
        </main>
    );
}

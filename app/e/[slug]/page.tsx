import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata, ResolvingMetadata } from "next";
import { HistoryTracker } from "@/components/HistoryTracker";
import { Calendar, Users, Ban, Download } from "lucide-react";
import { ManagerRecovery } from "@/features/auth";
import { VotingInterface } from "@/components/VotingInterface";
import { FinalizedEventView } from "@/components/FinalizedEventView";
import { CampaignStatusBanner } from "@/components/CampaignStatusBanner";
import Link from "next/link";
import { ClientDate, ClientTimezone } from "@/components/ClientDate";
import { readIdentity } from "@/shared/lib/session";
import {
    getEventForPage,
    toPublicEvent,
    toPublicParticipant,
    toPublicSlot,
} from "@/features/event-management";

interface PageProps {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ action?: string }>;
}

/**
 * @function generateMetadata
 * @description Generates dynamic metadata for the event page.
 */
export async function generateMetadata(props: PageProps, _parent: ResolvingMetadata): Promise<Metadata> {
    const params = await props.params;
    const event = await getEventForPage(params.slug);

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
export default async function EventPage(props: PageProps) {
    const searchParams = await props.searchParams;
    const params = await props.params;
    const event = await getEventForPage(params.slug);

    // Intent: Identify user from server-side cookie (Fail-safe for cross-browser sync).
    // This allows the voting interface to pre-fill "You are interacting as X".
    // Only signed identity cookies count; the numeric IDs stay on the server.
    const cookieStore = await cookies();
    const { chatId: userChatId, discordId: userDiscordId } = readIdentity(cookieStore);
    const userTelegramName = cookieStore.get("tabletop_user_telegram_name")?.value;
    const isTelegramSynced = !!userChatId;
    const isDiscordSynced = !!userDiscordId;
    const discordIdentity = userDiscordId
        ? { username: cookieStore.get("tabletop_user_discord_name")?.value || "Discord User" }
        : undefined;

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

    // Everything below this line that reaches a client component goes through the DTOs.
    const publicEvent = toPublicEvent(event);
    const publicParticipants = event.participants.map(p => toPublicParticipant(p, event.finalizedHostId));
    const publicSlots = event.timeSlots.map(toPublicSlot);
    const myTelegramHandle = event.participants.find(p => p.id === serverParticipantId)?.telegramId ?? null;

    // Optimization: Pre-calculate counts server-side to reduce client processing.
    const slotsWithCounts = publicSlots.map(slot => {
        const yes = slot.votes.filter(v => v.value === 'YES').length;
        const maybe = slot.votes.filter(v => v.value === 'MAYBE').length;
        const no = slot.votes.filter(v => v.value === 'NO').length;
        return { ...slot, counts: { yes, maybe, no } };
    });

    // Determine finalized slot/sessions if applicable
    const isFinalized = event.status === 'FINALIZED';
    const isCampaignFinalized = isFinalized && event.eventType === 'CAMPAIGN' && event.finalizedSessions.length > 0;
    const isOneShotFinalized = isFinalized && event.finalizedSlotId;
    const finalizedSlot = isOneShotFinalized ? publicSlots.find(s => s.id === event.finalizedSlotId) : null;

    return (
        <main className="min-h-screen bg-ink text-parchment p-4 md:p-8">
            <HistoryTracker slug={event.slug} title={event.title} />
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header Section */}
                <div className="space-y-4 border-b border-line pb-6">
                    <div className="flex items-center gap-3 text-gold-bright mb-2">
                        <Calendar className="w-5 h-5" aria-hidden="true" />
                        <span className="eyebrow">Scheduling Event</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="heading-display text-3xl md:text-5xl font-bold text-parchment">
                            {event.title}
                        </h1>
                        {event.eventType === "CAMPAIGN" && (
                            <span className="chip gap-1.5 px-2.5 py-1 border border-line-strong text-gold-bright font-semibold uppercase tracking-wider shrink-0">
                                <Calendar className="w-3 h-3" aria-hidden="true" />
                                Campaign
                            </span>
                        )}
                    </div>

                    {event.description && (
                        <p className="text-lg text-parchment-2 max-w-2xl leading-relaxed">
                            {event.description}
                        </p>
                    )}

                    {event.telegramLink && (
                        <div className="pt-2">
                            <a
                                href={event.telegramLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface text-telegram rounded-control border border-telegram/50 transition-colors font-medium text-sm"
                            >
                                <Users className="w-4 h-4" aria-hidden="true" />
                                Join Telegram Chat
                            </a>
                        </div>
                    )}

                    <div className="flex items-center gap-2 text-mist text-sm mt-4">
                        <Users className="w-4 h-4" aria-hidden="true" />
                        <span>Target: {event.minPlayers} players needed</span>
                    </div>
                </div>

                {/* Voting or Finalized View */}
                {/* Status Views Routing */}
                {event.status === 'CANCELLED' ? (
                    <div className="p-8 rounded-card bg-surface border border-no text-center space-y-6">
                        <div className="w-16 h-16 bg-no-bg rounded-card flex items-center justify-center mx-auto mb-4">
                            <Ban className="w-8 h-8 text-no" aria-hidden="true" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-no mb-2">Event Cancelled</h2>
                            <p className="text-parchment-2 text-lg max-w-lg mx-auto">
                                The organizer has cancelled this event.
                                <br />
                                No further voting or actions are allowed.
                            </p>
                        </div>
                        <div className="pt-4 border-t border-line">
                            <Link href="/" className="text-mist hover:text-parchment transition-colors text-sm underline">
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
                                    acceptedIds={event.participants.filter(p => p.status === 'ACCEPTED').map(p => p.id)}
                                    waitlistIds={event.participants.filter(p => p.status === 'WAITLIST').map(p => p.id)}
                                    serverParticipantId={serverParticipantId}
                                />

                                <div className="bg-surface border border-line border-t-2 border-t-yes rounded-card p-6 md:p-8 space-y-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-parchment mb-1">Campaign Sessions Locked In!</h2>
                                        <p className="text-yes text-sm">{event.finalizedSessions.length} session{event.finalizedSessions.length !== 1 ? 's' : ''} scheduled</p>
                                    </div>
                                    <div className="space-y-2">
                                        {event.finalizedSessions.map((session, index) => {
                                            return (
                                                <div key={session.id} className="bg-field rounded-control p-3 flex items-center gap-3 border border-line">
                                                    <div className="size-7 rounded-control bg-surface-2 flex items-center justify-center text-gold-bright font-bold text-xs shrink-0">
                                                        {index + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-semibold text-parchment text-sm">
                                                            <ClientDate date={session.timeSlot.startTime} formatStr="EEEE, MMMM do, yyyy" />
                                                        </div>
                                                        <div className="text-xs text-mist">
                                                            <ClientDate date={session.timeSlot.startTime} formatStr="h:mm a" /> – <ClientDate date={session.timeSlot.endTime} formatStr="h:mm a" />
                                                            <ClientTimezone className="ml-1 text-mist" />
                                                        </div>
                                                    </div>
                                                    <a
                                                        href={`/api/event/${event.slug}/ics?slot=${session.timeSlot.id}`}
                                                        title="Download this session (.ics)"
                                                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-control bg-surface-2 hover:bg-line border border-line-strong text-parchment-2 hover:text-parchment transition-colors shrink-0"
                                                    >
                                                        <Download className="w-3 h-3" aria-hidden="true" />
                                                        .ics
                                                    </a>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {event.location && (
                                        <div className="flex items-center gap-2 text-parchment-2 text-sm border-t border-line pt-4">
                                            <Calendar className="w-4 h-4 text-gold-bright" aria-hidden="true" />
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
                                        <div className="bg-surface rounded-card border border-line p-5 space-y-4">
                                            <div>
                                                <h3 className="text-sm font-semibold text-mist uppercase tracking-wider mb-3">Campaign Group</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {acceptedPlayers.map((p: any) => (
                                                        <span
                                                            key={p.id}
                                                            className={`text-sm px-3 py-1 rounded-control border font-medium ${
                                                                p.id === serverParticipantId
                                                                    ? 'bg-surface-2 border-gold text-gold-bright'
                                                                    : 'bg-surface-2 border-line-strong text-parchment-2'
                                                            }`}
                                                        >
                                                            {p.id === serverParticipantId ? `${p.name} (you)` : p.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            {waitlistPlayers.length > 0 && (
                                                <div className="border-t border-line pt-4">
                                                    <h3 className="text-sm font-semibold text-mist uppercase tracking-wider mb-3">Subs / Waitlist</h3>
                                                    <div className="flex flex-wrap gap-2">
                                                        {waitlistPlayers.map((p: any) => (
                                                            <span
                                                                key={p.id}
                                                                className={`text-sm px-3 py-1 rounded-control border font-medium opacity-60 ${
                                                                    p.id === serverParticipantId
                                                                        ? 'bg-maybe-bg border-maybe text-maybe'
                                                                        : 'bg-surface border-line text-mist'
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
                        event={publicEvent}
                        finalizedSlot={finalizedSlot}
                        participants={publicParticipants}
                        serverParticipantId={serverParticipantId}
                        discordIdentity={discordIdentity}
                    />
                ) : (
                    <VotingInterface
                        eventId={event.id}
                        initialSlots={slotsWithCounts}
                        participants={publicParticipants}
                        minPlayers={event.minPlayers}
                        slug={event.slug}
                        serverParticipantId={serverParticipantId}
                        eventType={event.eventType as "ONE_SHOT" | "CAMPAIGN"}
                        discordIdentity={discordIdentity}
                        telegramIdentity={userTelegramName ? { handle: userTelegramName } : undefined}
                        myTelegramHandle={myTelegramHandle}
                        isTelegramSynced={isTelegramSynced}
                        isDiscordSynced={isDiscordSynced}
                    />
                )}

                <div className="text-center pt-8 border-t border-line">
                    <p className="text-mist text-sm mb-2">Are you the organizer?</p>
                    <Link
                        href={`/e/${event.slug}/manage`}
                        className="text-gold hover:text-gold-bright underline underline-offset-4 text-sm transition-colors"
                    >
                        Manage Event & Finalize Time
                    </Link>
                </div>

                <ManagerRecovery slug={event.slug} defaultOpen={searchParams.action === 'login'} />

            </div>
        </main>
    );
}

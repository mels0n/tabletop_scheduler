import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata, ResolvingMetadata } from "next";
import prisma from "@/shared/lib/prisma";
import { HistoryTracker } from "@/components/HistoryTracker";
import { Calendar, Users } from "lucide-react";
import { ManagerRecovery } from "@/features/auth/ui/ManagerRecovery";
import { VotingInterface } from "@/components/VotingInterface";
import { FinalizedEventView } from "@/components/FinalizedEventView";
import Link from "next/link";

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

    let serverParticipantId: number | undefined;
    if (userChatId && event?.participants) {
        // Logic: Match the secure cookie ID against the participant list for this specific event.
        const found = event.participants.find(p => p.chatId === userChatId);
        if (found) {
            serverParticipantId = found.id;
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

    // Determine finalized slot if applicable
    const isFinalized = event.status === 'FINALIZED' && event.finalizedSlotId;
    const finalizedSlot = isFinalized ? event.timeSlots.find(s => s.id === event.finalizedSlotId) : null;

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

                    <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        {event.title}
                    </h1>

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
                ) : isFinalized && finalizedSlot ? (
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
                        serverParticipantId={serverParticipantId}
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

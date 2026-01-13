
import { notFound } from "next/navigation";
import prisma from "@/shared/lib/prisma";
import Link from "next/link";
import { checkSlotQuorum } from "@/shared/lib/quorum";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { ManagerControls } from "@/components/ManagerControls";
import { HistoryTracker } from "@/components/HistoryTracker";
import { ClientDate, ClientTimezone } from "@/components/ClientDate";
import { FinalizeEventModal } from "./FinalizeEventModal";
import { EditLocationModal } from "./EditLocationModal";
import { getBotUsername } from "@/features/telegram";
import { AddToCalendar } from "@/components/AddToCalendar";
import { TelegramConnect } from "@/components/TelegramConnect";
import { DiscordConnect } from "@/features/discord/ui/DiscordConnect";
import { ManagerVoteWarning } from "@/components/ManagerVoteWarning";
import { generateShortRecoveryToken } from "@/app/actions";

/**
 * @interface PageProps
 * @description Standard Next.js page props interface with dynamic route parameters.
 */
interface PageProps {
    params: { slug: string };
}

/**
 * @function getEventWithVotes
 * @description Fetches the event and deep-nested relations required for the Management Dashboard.
 *
 * Data Requirements:
 * - TimeSlots: Sorted by creation/time.
 * - Votes: Includes 'participant' relation to identify potential hosts.
 * - Participants: To calculate total turnout percentage.
 * - FinalizedHost: Relation for the display block.
 *
 * @param {string} slug - The event slug.
 */
async function getEventWithVotes(slug: string) {
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
            finalizedHost: true
        },
    });
    return event;
}

/**
 * @component ManageEventPage
 * @description The "Command Center" for an event organizer.
 *
 * Capabilities:
 * 1. View all proposed time slots ranked by viability (Perfect, Viable, etc.).
 * 2. See detailed breakdown of Votes (Yes/Maybe/No) and Host availability.
 * 3. "Finalize" a slot, which locks the event, updates the DB, and notifies Telegram.
 * 4. Connect/Manage Telegram integration setting.
 * 5. Configure "Reminders" and "Cleanup" settings.
 *
 * Logic:
 * - Pre-sorts TimeSlots based on a heuristic: Perfect > Has Host > Total Votes > Yes Votes.
 * - Conditional Rendering: Switches between "Voting Mode" (list of slots) and "Finalized Mode" (Big Green Success Card).
 */
export default async function ManageEventPage({ params }: PageProps) {
    const event = await getEventWithVotes(params.slug);

    if (!event) {
        notFound();
    }

    const botUsername = await getBotUsername(process.env.TELEGRAM_BOT_TOKEN || '') || 'TabletopSchedulerBot';

    // Algorithm: Score and Sort Slots
    const slots = event.timeSlots.map(slot => {
        const yesCount = slot.votes.filter(v => v.preference === 'YES').length;
        const maybeCount = slot.votes.filter(v => v.preference === 'MAYBE').length;
        const noCount = slot.votes.filter(v => v.preference === 'NO').length;
        const totalParticipants = event.participants.length;

        // Check if anyone can host in this slot (for UI display if needed, but checkSlotQuorum handles logic)
        const hasHost = slot.votes.some(v => (v.preference === 'YES' || v.preference === 'MAYBE') && v.canHost);

        // Centralized Quorum Logic
        const { viable, perfect } = checkSlotQuorum(slot, event.minPlayers, totalParticipants);

        const potentialHosts = slot.votes
            .filter(v => (v.preference === 'YES' || v.preference === 'MAYBE') && v.canHost)
            .map(v => v.participant);

        return {
            ...slot,
            yesCount,
            maybeCount,
            noCount,
            viable,
            perfect,
            hasHost,
            potentialHosts
        };
    });

    // Custom Sort Strategy:
    // 1. "Perfect" (Everyone + Host) is top priority.
    // 2. "Has Host" is second priority (logistics are hard).
    // 3. "Total Turnout" (Yes + Maybe) is third.
    // 4. "Strong Preference" (Yes count) is fourth.
    slots.sort((a, b) => {
        // 1. Status Category (Perfect > Viable > Low)
        // We rely on 'perfect' flag for top tier.
        if (a.perfect && !b.perfect) return -1;
        if (!a.perfect && b.perfect) return 1;

        // 2. Has Host House
        if (a.hasHost && !b.hasHost) return -1;
        if (!a.hasHost && b.hasHost) return 1;

        // 3. Total Turnout (Yes + Maybe)
        const aTotal = a.yesCount + a.maybeCount;
        const bTotal = b.yesCount + b.maybeCount;
        if (bTotal !== aTotal) return bTotal - aTotal;

        // 4. Total Yes
        if (b.yesCount !== a.yesCount) return b.yesCount - a.yesCount;

        return 0;
    });

    const isFinalized = event.status === 'FINALIZED';
    const finalizedSlot = isFinalized ? event.timeSlots.find(s => s.id === event.finalizedSlotId) : null;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12">
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

                    {/* LEFT COLUMN: Event Info & Controls */}
                    <div className="lg:col-span-5 space-y-8">
                        <div className="border-b border-slate-800 pb-6">
                            <div className="flex justify-between items-start gap-4">
                                <div>
                                    <h1 className="text-3xl font-bold mb-2 break-words">Manage: {event.title}</h1>
                                    <p className="text-slate-400">Pick the best time and notify your players.</p>
                                </div>
                                <Link
                                    href={`/e/${event.slug}`}
                                    className="shrink-0 px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-900 transition-colors text-xs whitespace-nowrap hidden md:inline-block"
                                >
                                    View as Player
                                </Link>
                            </div>

                            <div className="mt-4 flex items-center gap-4">
                                <CopyLinkButton url={`/e/${event.slug}`} />
                                <Link
                                    href={`/e/${event.slug}`}
                                    className="px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-900 transition-colors text-xs whitespace-nowrap md:hidden"
                                >
                                    View as Player
                                </Link>
                            </div>
                        </div>

                        {/* Client-side navigation history update */}
                        <HistoryTracker slug={event.slug} title={event.title} />

                        <TelegramConnect
                            slug={event.slug}
                            botUsername={botUsername || 'TabletopSchedulerBot'}
                            initialTelegramLink={event.telegramLink}
                            hasChatId={!!event.telegramChatId}
                            initialHandle={event.managerTelegram}
                            hasManagerChatId={!!event.managerChatId}
                        />

                        <DiscordConnect
                            slug={event.slug}
                            hasChannel={!!event.discordChannelId}
                            guildId={event.discordGuildId}
                            channelId={event.discordChannelId}
                            hasManagerDiscordId={!!event.managerDiscordId}
                        />

                        <ManagerControls
                            slug={event.slug}
                            isFinalized={event.status === "FINALIZED"}
                            isCancelled={event.status === "CANCELLED"}
                            isTelegramConnected={!!event.telegramChatId}
                            isDiscordConnected={!!event.discordChannelId}
                            initialReminderEnabled={event.reminderEnabled}
                            initialReminderTime={event.reminderTime}
                            initialReminderDays={event.reminderDays}
                        />
                    </div>

                    {/* RIGHT COLUMN: Slots / Finalized State */}
                    <div className="lg:col-span-7 space-y-6">
                        {isFinalized && finalizedSlot ? (
                            /* FINALIZED STATE UI */
                            <>
                                <div className="p-8 rounded-2xl bg-gradient-to-br from-green-900/20 to-slate-900/40 border border-green-800/50 text-center space-y-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-green-400 mb-2">Event Finalized!</h2>
                                        <p className="text-slate-300 text-lg">
                                            Playing on <br />
                                            <ClientDate date={finalizedSlot.startTime} formatStr="EEEE, MMMM do" className="font-semibold text-white" />
                                            <span className="text-slate-400"> at </span>
                                            <ClientDate date={finalizedSlot.startTime} formatStr="h:mm a" className="font-semibold text-white" />
                                            <ClientTimezone className="ml-1.5 text-slate-400 font-normal text-base" />
                                        </p>


                                        {(event.finalizedHost || event.location) && (
                                            <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 inline-block text-left text-sm space-y-2 min-w-[250px]">
                                                {event.finalizedHost && (
                                                    <div className="flex items-center gap-2 text-slate-300">
                                                        <span className="text-lg">🏠</span>
                                                        <span>Hosted by <span className="font-semibold text-white">{event.finalizedHost.name}</span></span>
                                                    </div>
                                                )}
                                                {event.location && (
                                                    <div className="flex items-start gap-2 text-slate-300">
                                                        <span className="text-lg mt-0.5">📍</span>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className="font-medium text-slate-400 text-xs uppercase tracking-wide">Location</div>
                                                                <EditLocationModal slug={event.slug} initialLocation={event.location} />
                                                            </div>
                                                            <div className="text-white">{event.location}</div>
                                                        </div>
                                                    </div>
                                                )}
                                                {!event.location && (
                                                    <div className="flex items-start gap-2 text-slate-300">
                                                        <span className="text-lg mt-0.5">📍</span>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className="font-medium text-slate-400 text-xs uppercase tracking-wide">Location</div>
                                                                <EditLocationModal slug={event.slug} initialLocation={null} />
                                                            </div>
                                                            <div className="text-slate-500 italic">TBD</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="border-t border-slate-700/50 pt-6">
                                        <AddToCalendar
                                            event={{
                                                ...event,
                                                description: event.description || undefined
                                            }}
                                            slot={finalizedSlot}
                                            className="justify-center"
                                        />
                                    </div>
                                </div>

                                {/* Finalized Attendees List */}
                                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                                    <h3 className="text-lg font-semibold text-slate-300 mb-4 flex items-center justify-between">
                                        <span>Who&apos;s Going</span>
                                        <div className="flex items-center gap-2">
                                            <span className="bg-slate-800 text-slate-400 px-2 py-1 rounded text-xs">
                                                {event.maxPlayers
                                                    ? `${finalizedSlot.votes.filter((v: any) => (v.preference === 'YES' || v.preference === 'MAYBE') && (!v.participant.status || v.participant.status === 'ACCEPTED')).length}/${event.maxPlayers}`
                                                    : finalizedSlot.votes.filter((v: any) => (v.preference === 'YES' || v.preference === 'MAYBE') && (!v.participant.status || v.participant.status === 'ACCEPTED')).length
                                                }
                                            </span>
                                        </div>
                                    </h3>

                                    <ul className="space-y-3 mb-8">
                                        {finalizedSlot.votes
                                            .filter((v: any) => (v.preference === 'YES' || v.preference === 'MAYBE') && (!v.participant.status || v.participant.status === 'ACCEPTED'))
                                            .map((v: any) => (
                                                <li key={v.participant.id} className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs ring-2 ring-slate-900">
                                                        {v.participant.name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-slate-200">
                                                            {v.participant.name}
                                                            {v.participant.telegramId && <span className="ml-2 text-xs text-indigo-400 font-normal">{v.participant.telegramId}</span>}
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                    </ul>

                                    {finalizedSlot.votes.some((v: any) => v.participant.status === 'WAITLIST') && (
                                        <div className="border-t border-slate-800 pt-6">
                                            <h3 className="text-lg font-semibold text-slate-300 mb-4 flex items-center justify-between">
                                                <span>Waitlist</span>
                                                <span className="bg-yellow-900/30 text-yellow-500 px-2 py-1 rounded text-xs border border-yellow-900/50">
                                                    {finalizedSlot.votes.filter((v: any) => v.participant.status === 'WAITLIST').length}
                                                </span>
                                            </h3>
                                            <ul className="space-y-3">
                                                {finalizedSlot.votes
                                                    .filter((v: any) => v.participant.status === 'WAITLIST')
                                                    .map((v: any) => (
                                                        <li key={v.participant.id} className="flex items-center gap-3 opacity-60">
                                                            <div className="w-8 h-8 rounded-full bg-yellow-900/20 flex items-center justify-center text-yellow-600 font-bold text-xs ring-1 ring-yellow-900/50">
                                                                {v.participant.name.substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-slate-400">
                                                                    {v.participant.name}
                                                                    {v.participant.telegramId && <span className="ml-2 text-xs text-yellow-600/50 font-normal">{v.participant.telegramId}</span>}
                                                                </div>
                                                            </div>
                                                        </li>
                                                    ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : event.status === 'CANCELLED' ? (
                            /* CANCELLED STATE UI */
                            <div className="p-8 rounded-2xl bg-slate-900 border border-red-900/50 text-center space-y-6">
                                <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-3xl">🚫</span>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-red-500 mb-2">Event Cancelled</h2>
                                    <p className="text-slate-400 text-lg">
                                        You have cancelled this event via the manager controls.
                                    </p>
                                    <p className="text-slate-500 text-sm mt-2">
                                        The event is visible to users as &quot;Cancelled&quot; but no actions can be taken.
                                        You can permanently delete it from the database using the &quot;Delete&quot; button.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            /* VOTING STATE UI */
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold text-slate-200">Proposed Slots</h2>
                                    <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Best Options First</span>
                                </div>

                                <ManagerVoteWarning
                                    eventId={event.id}
                                    participants={event.participants}
                                    slug={event.slug}
                                />

                                <div className="grid gap-3">
                                    {slots.length === 0 ? (
                                        <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                                            No time slots proposed yet.
                                        </div>
                                    ) : slots.map(slot => (
                                        <div key={slot.id} className="group relative p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/60 transition-colors flex flex-col sm:flex-row items-center justify-between gap-4">
                                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                                <div className="text-center min-w-[60px] shrink-0">
                                                    {slot.perfect && <div className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-1 bg-green-900/20 px-1.5 py-0.5 rounded">Perfect</div>}
                                                    {!slot.hasHost && <div className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1 bg-orange-900/20 px-1.5 py-0.5 rounded">No Host</div>}
                                                    {slot.viable && !slot.perfect && slot.hasHost && <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1 bg-indigo-900/20 px-1.5 py-0.5 rounded">Viable</div>}
                                                    {!slot.viable && <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1 bg-slate-800/50 px-1.5 py-0.5 rounded">Low T/O</div>}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-base text-slate-200">
                                                        <ClientDate date={slot.startTime} formatStr="EEE, MMM d @ h:mm a" />
                                                        <ClientTimezone className="ml-1 text-slate-500 font-normal text-sm" />
                                                    </div>
                                                    <div className="text-sm text-slate-400 flex gap-3 mt-0.5">
                                                        <span className="text-green-400 font-medium">{slot.yesCount} Yes</span>
                                                        <span className="text-yellow-500/80">{slot.maybeCount} If Needed</span>
                                                        <span className="text-red-900/60">{slot.noCount} No</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <FinalizeEventModal
                                                slug={event.slug}
                                                slotId={slot.id}
                                                potentialHosts={slot.potentialHosts}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
}

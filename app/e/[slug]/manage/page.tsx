
import { notFound, redirect } from "next/navigation";
import prisma from "@/shared/lib/prisma";
import Link from "next/link";
import { checkSlotQuorum } from "@/shared/lib/quorum";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { ManagerControls } from "@/components/ManagerControls";
import { HistoryTracker } from "@/components/HistoryTracker";
import { ClientDate, ClientTimezone } from "@/components/ClientDate";
import { FinalizeEventModal } from "./FinalizeEventModal";
import { CampaignFinalizeModal } from "./CampaignFinalizeModal";
import { CampaignSessionsView } from "./CampaignSessionsView";
import { EditLocationModal } from "./EditLocationModal";
import { getBotUsername } from "@/features/telegram/lib/telegram-client";
import { AddToCalendar } from "@/components/AddToCalendar";
import { TelegramConnect } from "@/components/TelegramConnect";
import { DiscordConnect } from "@/features/discord/ui/DiscordConnect";
import { ManagerVoteWarning } from "@/components/ManagerVoteWarning";
import { ManageParticipants } from "@/components/ManageParticipants";
import { ManageSlots } from "@/components/ManageSlots";
import { verifyEventAdmin } from "@/features/auth/server/actions";
import { googleCalendarUrl, outlookCalendarUrl } from "@/shared/lib/calendar";

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
            finalizedHost: true,
            finalizedSessions: {
                include: { timeSlot: true },
                orderBy: { timeSlot: { startTime: 'asc' } }
            }
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
    // Security: Verify Admin Access Server-Side
    // Middleware only checks for cookie presence, not validity.
    const isAdmin = await verifyEventAdmin(params.slug);
    if (!isAdmin) {
        redirect(`/e/${params.slug}?action=login`);
    }

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
    const isCampaign = event.eventType === 'CAMPAIGN';
    const finalizedSlot = isFinalized && !isCampaign ? event.timeSlots.find(s => s.id === event.finalizedSlotId) : null;
    const finalizedSessions = event.finalizedSessions ?? [];

    // Campaign session grouping — order-independent algorithm:
    // 1. Compute pairwise intersections across all voted sessions to find candidate group keys
    // 2. Rank candidate keys by size DESC then coverage DESC
    // 3. Greedily assign each session to the largest key it qualifies for
    // This correctly handles "same 4 + bonus player" as one group, and doesn't break
    // when sessions have overlapping but not identical attendee sets.
    const campaignSessionGroups = isCampaign && !isFinalized ? (() => {
        const min = event.minPlayers;

        const slotEntries = slots.map(slot => {
            const attendees = slot.votes
                .filter(v => v.preference === 'YES' || v.preference === 'MAYBE')
                .map(v => ({ id: v.participant.id, name: v.participant.name, preference: v.preference as 'YES' | 'MAYBE' }))
                .sort((a, b) => a.name.localeCompare(b.name));
            const attendeeIds = new Set(attendees.map(a => a.id));
            const hasHost = slot.votes.some(v => (v.preference === 'YES' || v.preference === 'MAYBE') && v.canHost);
            return { slot: { ...slot, hasHost }, attendees, attendeeIds };
        });

        const withVotes = slotEntries.filter(e => e.attendees.length > 0);
        const noVotes   = slotEntries.filter(e => e.attendees.length === 0);

        // Step 1: collect every pairwise intersection as a candidate group key
        const candidateMap = new Map<string, { key: Set<number>; keyAttendees: typeof withVotes[0]['attendees'] }>();
        for (let i = 0; i < withVotes.length; i++) {
            for (let j = i + 1; j < withVotes.length; j++) {
                const intersection = withVotes[i].attendees.filter(a => withVotes[j].attendeeIds.has(a.id));
                if (intersection.length === 0) continue;
                const sig = intersection.map(a => a.id).sort((x, y) => x - y).join(',');
                if (!candidateMap.has(sig)) {
                    candidateMap.set(sig, { key: new Set(intersection.map(a => a.id)), keyAttendees: intersection });
                }
            }
        }

        // Step 2: for each candidate key, collect ALL sessions that qualify —
        //         sessions can and should appear in multiple groups (a date with 5 players
        //         is valid for both the 4-player group and any 2-player subset groups).
        //         Keep groups with ≥ 2 qualifying sessions; sort largest key first.
        type Group = { sig: string; key: Set<number>; keyAttendees: typeof withVotes[0]['attendees']; slots: Array<typeof withVotes[0]['slot']> };
        const groups: Group[] = Array.from(candidateMap.entries())
            .map(([sig, { key, keyAttendees }]) => ({
                sig, key, keyAttendees,
                slots: withVotes
                    .filter(e => Array.from(key).every(id => e.attendeeIds.has(id)))
                    .map(e => e.slot),
            }))
            .filter(g => g.slots.length >= 2)
            .sort((a, b) => b.key.size - a.key.size || b.slots.length - a.slots.length);

        // Sessions that don't appear in any group → singleton (unique player combo, no overlap)
        const appearsInGroup = new Set(groups.flatMap(g => g.slots.map(s => s.id)));
        for (const { slot, attendees, attendeeIds } of withVotes) {
            if (appearsInGroup.has(slot.id)) continue;
            const sig = Array.from(attendeeIds).sort((a, b) => a - b).join(',');
            const existing = groups.find(g => g.sig === sig);
            if (existing) existing.slots.push(slot);
            else groups.push({ sig, key: attendeeIds, keyAttendees: attendees, slots: [slot] });
        }

        const minSessions = event.minSessions ?? 1;
        const maxPlayers  = event.maxPlayers  ?? Infinity;

        const result = groups
            .map(g => {
                const sortedSlots = g.slots.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
                const coreYesCount = Array.from(g.key).filter(id =>
                    sortedSlots.some(s => s.votes.some((v: { participant: { id: number }; preference: string }) => v.participant.id === id && v.preference === 'YES'))
                ).length;
                return {
                    attendees: g.keyAttendees,
                    coreIds: g.key,
                    slots: sortedSlots,
                    meetsQuorum: g.key.size >= min,
                    meetsMinDates: g.slots.length >= minSessions,
                    playerCount: g.key.size,
                    coreYesCount,
                    noVotes: false,
                };
            })
            .sort((a, b) => {
                // 1. Groups that meet the minimum session target first
                if (a.meetsMinDates !== b.meetsMinDates) return a.meetsMinDates ? -1 : 1;
                // 2. Within those: most players, capped at maxPlayers (extra players beyond cap add no value)
                const aCapped = Math.min(a.playerCount, maxPlayers);
                const bCapped = Math.min(b.playerCount, maxPlayers);
                if (bCapped !== aCapped) return bCapped - aCapped;
                // 3. Most core players with a hard YES (not MAYBE) on at least one slot
                if (b.coreYesCount !== a.coreYesCount) return b.coreYesCount - a.coreYesCount;
                // 4. Tiebreak: most dates
                return b.slots.length - a.slots.length;
            });

        if (noVotes.length > 0) {
            result.push({
                attendees: [],
                coreIds: new Set<number>(),
                slots: noVotes.map(e => e.slot).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
                meetsQuorum: false,
                meetsMinDates: false,
                playerCount: 0,
                coreYesCount: 0,
                noVotes: true,
            });
        }

        return result;
    })() : [];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12">
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

                    {/* LEFT COLUMN */}
                    <div className="lg:col-span-5 space-y-8">

                        {/* Event header */}
                        <div>
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <h1 className="text-2xl font-bold text-slate-50 break-words leading-snug">{event.title}</h1>
                                <Link
                                    href={`/e/${event.slug}`}
                                    className="shrink-0 px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-900 transition-colors text-xs whitespace-nowrap"
                                >
                                    View as Player
                                </Link>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">Share:</span>
                                <CopyLinkButton url={`/e/${event.slug}`} />
                            </div>
                        </div>

                        <HistoryTracker slug={event.slug} title={event.title} />

                        {/* Notifications */}
                        <div className="space-y-3">
                            <SidebarLabel>Notifications</SidebarLabel>
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
                        </div>

                        {/* Event Settings */}
                        <div className="space-y-3">
                            <SidebarLabel>Event Settings</SidebarLabel>
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

                        {/* Players */}
                        <div className="space-y-3">
                            <SidebarLabel>Players</SidebarLabel>
                            {event.participants.length > 0 ? (
                                <ManageParticipants slug={event.slug} participants={event.participants} />
                            ) : (
                                <p className="text-xs text-slate-500 py-1">No players have voted yet.</p>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Slots / Finalized State */}
                    <div className="lg:col-span-7 space-y-6">
                        {isFinalized && isCampaign ? (
                            /* CAMPAIGN FINALIZED STATE */
                            <>
                                <div className="p-8 rounded-2xl bg-gradient-to-br from-indigo-900/20 to-slate-900/40 border border-indigo-800/50 space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-2xl font-bold text-indigo-300 mb-1">Campaign Finalized!</h2>
                                        <p className="text-slate-400 text-sm">{finalizedSessions.length} session{finalizedSessions.length !== 1 ? 's' : ''} locked in</p>
                                    </div>
                                    <div className="space-y-2">
                                        {finalizedSessions.map((fs, i) => {
                                            const calEvent = {
                                                title: `${event.title} — Session ${i + 1}`,
                                                description: event.description ?? undefined,
                                                location: event.location ?? undefined,
                                                slug: event.slug,
                                            };
                                            const gUrl = googleCalendarUrl(calEvent, new Date(fs.timeSlot.startTime), new Date(fs.timeSlot.endTime));
                                            const oUrl = outlookCalendarUrl(calEvent, new Date(fs.timeSlot.startTime), new Date(fs.timeSlot.endTime));
                                            return (
                                                <div key={fs.id} className="flex items-center gap-3 p-3 bg-slate-900/60 rounded-lg border border-slate-700/50">
                                                    <span className="text-xs font-bold text-indigo-400 bg-indigo-900/30 rounded px-1.5 py-0.5 min-w-[28px] text-center shrink-0">
                                                        {i + 1}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <ClientDate date={fs.timeSlot.startTime} formatStr="EEEE, MMMM do" className="font-semibold text-white text-sm" />
                                                        <span className="text-slate-400 text-sm"> at </span>
                                                        <ClientDate date={fs.timeSlot.startTime} formatStr="h:mm a" className="font-semibold text-white text-sm" />
                                                        <ClientTimezone className="ml-1.5 text-slate-500 font-normal text-xs" />
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <a href={gUrl} target="_blank" rel="noopener noreferrer" title="Add to Google Calendar" className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-colors whitespace-nowrap">
                                                            📅 Google
                                                        </a>
                                                        <a href={oUrl} target="_blank" rel="noopener noreferrer" title="Add to Outlook" className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-colors whitespace-nowrap">
                                                            📧 Outlook
                                                        </a>
                                                        <a href={`/api/event/${event.slug}/ics?slot=${fs.timeSlot.id}`} title="Download this session as .ics" className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white transition-colors whitespace-nowrap">
                                                            📎 .ics
                                                        </a>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {(event.finalizedHost || event.location) && (
                                        <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 text-sm space-y-2">
                                            {event.finalizedHost && (
                                                <div className="flex items-center gap-2 text-slate-300">
                                                    <span className="text-base">🏠</span>
                                                    <span>Hosted by <span className="font-semibold text-white">{event.finalizedHost.name}</span></span>
                                                </div>
                                            )}
                                            {event.location ? (
                                                <div className="flex items-start gap-2 text-slate-300">
                                                    <span className="text-base mt-0.5">📍</span>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-medium text-slate-400 text-xs uppercase tracking-wide">Location</div>
                                                            <EditLocationModal slug={event.slug} initialLocation={event.location} />
                                                        </div>
                                                        <div className="text-white">{event.location}</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-start gap-2 text-slate-300">
                                                    <span className="text-base mt-0.5">📍</span>
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

                                {/* Campaign Attendees */}
                                <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                                    <h3 className="text-lg font-semibold text-slate-300 mb-4">Campaign Group</h3>
                                    <ul className="space-y-3 mb-4">
                                        {event.participants.filter(p => p.status === 'ACCEPTED').map(p => (
                                            <li key={p.id} className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs ring-2 ring-slate-900">
                                                    {p.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="font-medium text-slate-200">
                                                    {p.name}
                                                    {p.telegramId && <span className="ml-2 text-xs text-indigo-400 font-normal">{p.telegramId}</span>}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                    {event.participants.some(p => p.status === 'WAITLIST') && (
                                        <div className="border-t border-slate-800 pt-4">
                                            <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                                                Subs / Waitlist
                                                <span className="bg-yellow-900/30 text-yellow-500 px-2 py-0.5 rounded text-xs border border-yellow-900/50">
                                                    {event.participants.filter(p => p.status === 'WAITLIST').length}
                                                </span>
                                            </h3>
                                            <ul className="space-y-2">
                                                {event.participants.filter(p => p.status === 'WAITLIST').map(p => (
                                                    <li key={p.id} className="flex items-center gap-3 opacity-60">
                                                        <div className="w-8 h-8 rounded-full bg-yellow-900/20 flex items-center justify-center text-yellow-600 font-bold text-xs ring-1 ring-yellow-900/50">
                                                            {p.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div className="font-medium text-slate-400">{p.name}</div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : isFinalized && finalizedSlot ? (
                            /* ONE-SHOT FINALIZED STATE UI */
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
                            isCampaign ? (
                                /* CAMPAIGN VOTING: grouped by attendee set */
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                        <div>
                                            <h2 className="text-xl font-semibold text-slate-200">Candidate Sessions</h2>
                                            <p className="text-xs text-slate-500 mt-0.5">Click a group to select it and finalize</p>
                                        </div>
                                    </div>

                                    <CampaignSessionsView
                                        slug={event.slug}
                                        minPlayers={event.minPlayers}
                                        groups={campaignSessionGroups.map(g => ({
                                            attendees: g.attendees,
                                            coreIds: Array.from(g.coreIds),
                                            meetsQuorum: g.meetsQuorum,
                                            meetsMinDates: g.meetsMinDates,
                                            playerCount: g.playerCount,
                                            noVotes: g.noVotes,
                                            slots: g.slots.map(s => ({
                                                id: s.id,
                                                startTime: new Date(s.startTime).toISOString(),
                                                hasHost: s.hasHost,
                                                votes: s.votes
                                                    .filter((v: any) => v.preference === 'YES' || v.preference === 'MAYBE')
                                                    .map((v: any) => ({
                                                        participantId: v.participantId,
                                                        preference: v.preference,
                                                        canHost: v.canHost ?? false,
                                                        participant: { id: v.participant.id, name: v.participant.name },
                                                    })),
                                            })),
                                        }))}
                                    />

                                    <ManageSlots slug={event.slug} slots={event.timeSlots} />
                                </div>
                            ) : (
                                /* ONE-SHOT VOTING: sorted slot cards */
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

                                    <div className="grid gap-2">
                                        {slots.length === 0 ? (
                                            <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                                                No time slots proposed yet.
                                            </div>
                                        ) : slots.map((slot, index) => {
                                            const totalParticipants = event.participants.length;
                                            const yesVoters = slot.votes.filter((v: any) => v.preference === 'YES');
                                            const maybeVoters = slot.votes.filter((v: any) => v.preference === 'MAYBE');
                                            const noVoters = slot.votes.filter((v: any) => v.preference === 'NO');
                                            const unvotedCount = Math.max(0, totalParticipants - yesVoters.length - maybeVoters.length - noVoters.length);

                                            const cardClass = slot.perfect
                                                ? "border-green-800/40 bg-green-950/10"
                                                : !slot.viable
                                                ? "border-slate-800/30 bg-slate-900/20 opacity-60"
                                                : !slot.hasHost
                                                ? "border-amber-900/30 bg-slate-900/40"
                                                : "border-slate-700/60 bg-slate-900/40";

                                            return (
                                                <div key={slot.id} className={`rounded-xl border p-4 transition-all ${cardClass}`}>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap mb-2">
                                                                <span className="font-semibold text-slate-100 text-sm">
                                                                    <ClientDate date={slot.startTime} formatStr="EEE, MMM d @ h:mm a" />
                                                                    <ClientTimezone className="ml-1 text-slate-500 font-normal" />
                                                                </span>
                                                                {slot.perfect && (
                                                                    <span className="text-xs font-medium text-green-400 bg-green-900/20 px-2 py-0.5 rounded-full">Perfect</span>
                                                                )}
                                                                {!slot.hasHost && (
                                                                    <span className="text-xs font-medium text-amber-500/90 bg-amber-900/10 px-2 py-0.5 rounded-full">No host</span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1 flex-wrap">
                                                                {yesVoters.map((v: any) => (
                                                                    <span key={v.participant.id} title={v.participant.name} className="w-3 h-3 rounded-full bg-green-500/80 cursor-help shrink-0" />
                                                                ))}
                                                                {maybeVoters.map((v: any) => (
                                                                    <span key={v.participant.id} title={v.participant.name} className="w-3 h-3 rounded-full bg-amber-500/70 cursor-help shrink-0" />
                                                                ))}
                                                                {noVoters.map((v: any) => (
                                                                    <span key={v.participant.id} title={v.participant.name} className="w-3 h-3 rounded-full bg-red-800/50 cursor-help shrink-0" />
                                                                ))}
                                                                {Array.from({ length: unvotedCount }).map((_, i) => (
                                                                    <span key={`u-${i}`} className="w-3 h-3 rounded-full bg-slate-700/80 shrink-0" />
                                                                ))}
                                                                <span className="ml-2 text-xs text-slate-500">
                                                                    {slot.yesCount} yes
                                                                    {slot.maybeCount > 0 && ` · ${slot.maybeCount} maybe`}
                                                                    {slot.noCount > 0 && ` · ${slot.noCount} no`}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <FinalizeEventModal
                                                            slug={event.slug}
                                                            slotId={slot.id}
                                                            potentialHosts={slot.potentialHosts}
                                                            prominent={index === 0}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <ManageSlots slug={event.slug} slots={event.timeSlots} />
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
}

function SidebarLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest whitespace-nowrap">{children}</span>
            <div className="flex-1 h-px bg-slate-800" />
        </div>
    );
}


import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CalendarPlus, Mail, Download, Home, MapPin, Ban } from "lucide-react";
import { checkSlotQuorum } from "@/shared/lib/quorum";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { ManagerControls } from "@/components/ManagerControls";
import { HistoryTracker } from "@/components/HistoryTracker";
import { ClientDate, ClientTimezone } from "@/components/ClientDate";
import { FinalizeEventModal } from "./FinalizeEventModal";
import { CampaignSessionsView } from "./CampaignSessionsView";
import { EditLocationModal } from "./EditLocationModal";
import { AddToCalendar } from "@/components/AddToCalendar";
import { TelegramConnect } from "@/components/TelegramConnect";
import { DiscordConnect, isDiscordOAuthConfigured } from "@/features/integrations/discord";
import { ManagerVoteWarning } from "@/components/ManagerVoteWarning";
import { ManageParticipants } from "@/components/ManageParticipants";
import { ManageSlots } from "@/components/ManageSlots";
import { SyncBadge } from "@/components/SyncBadge";
import { googleCalendarUrl, outlookCalendarUrl } from "@/shared/lib/calendar";
import { toManageParticipant } from "@/features/event-management";
import { loadManagePage } from "./load";

/**
 * @interface PageProps
 * @description Standard Next.js page props interface with dynamic route parameters.
 */
interface PageProps {
    params: Promise<{ slug: string }>;
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
 * - Pre-sorts TimeSlots based on a heuristic: Perfect > Total Votes > Yes Votes > Has Host.
 * - Conditional Rendering: Switches between "Voting Mode" (list of slots) and "Finalized Mode" (Big Green Success Card).
 */
export default async function ManageEventPage(props: PageProps) {
    const params = await props.params;
    // Security: Verify Admin Access Server-Side
    // Middleware only checks for cookie presence, not validity.
    const data = await loadManagePage(params.slug);
    if (!data.isAdmin) {
        redirect(`/e/${params.slug}?action=login`);
    }

    const { event, botUsername } = data;
    const discordOAuthEnabled = isDiscordOAuthConfigured();
    if (!event) {
        notFound();
    }

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
            .map(v => ({ id: v.participant.id, name: v.participant.name }));

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
    // 2. "Total Turnout" (Yes + Maybe) is second, because availability is the scarce resource.
    // 3. "Strong Preference" (Yes count) is third.
    // 4. "Has Host" breaks ties, since a location is easier to find than a person.
    slots.sort((a, b) => {
        // 1. Status Category (Perfect > Viable > Low)
        // We rely on 'perfect' flag for top tier.
        if (a.perfect && !b.perfect) return -1;
        if (!a.perfect && b.perfect) return 1;

        // 2. Total Turnout (Yes + Maybe)
        const aTotal = a.yesCount + a.maybeCount;
        const bTotal = b.yesCount + b.maybeCount;
        if (bTotal !== aTotal) return bTotal - aTotal;

        // 3. Total Yes
        if (b.yesCount !== a.yesCount) return b.yesCount - a.yesCount;

        // 4. Has Host House
        if (a.hasHost && !b.hasHost) return -1;
        if (!a.hasHost && b.hasHost) return 1;

        return 0;
    });

    // Client components get DTOs and narrow props only, never Prisma rows: rows carry platform
    // IDs and, on the event, the admin token hash.
    const manageParticipants = event.participants.map(p => toManageParticipant(p, event.finalizedHostId));
    const manageSlotRows = event.timeSlots.map(s => ({ id: s.id, startTime: s.startTime, endTime: s.endTime }));
    const participantIds = event.participants.map(p => ({ id: p.id }));

    const isFinalized = event.status === 'FINALIZED';
    const isCampaign = event.eventType === 'CAMPAIGN';
    const finalizedSlot = isFinalized && !isCampaign ? event.timeSlots.find(s => s.id === event.finalizedSlotId) : null;
    const finalizedSessions = event.finalizedSessions ?? [];

    // Campaign session grouping (order-independent algorithm):
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

        // Step 2: for each candidate key, collect ALL sessions that qualify:
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
        <div className="min-h-screen bg-ink text-parchment p-6 md:p-12">
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

                    {/* LEFT COLUMN */}
                    <div className="lg:col-span-5 space-y-8">

                        {/* Event header */}
                        <div>
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <h1 className="text-2xl font-bold text-parchment break-words leading-snug">{event.title}</h1>
                                <Link
                                    href={`/e/${event.slug}`}
                                    className="shrink-0 px-3 py-1.5 rounded border border-line-strong hover:bg-surface transition-colors text-xs whitespace-nowrap"
                                >
                                    View as Player
                                </Link>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-mist">Share:</span>
                                <CopyLinkButton url={`/e/${event.slug}`} />
                            </div>
                            {/* Manager sync status: which platform(s) this manager record can
                                recover a login link through, independent of participant sync
                                badges shown on the profile page. */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-3">
                                {event.managerChatId && <SyncBadge variant="telegram" />}
                                {event.managerDiscordId && <SyncBadge variant="discord" />}
                                {!event.managerChatId && !event.managerDiscordId && (
                                    <span className="text-xs uppercase font-bold tracking-wide px-2 py-0.5 bg-surface-2 text-mist rounded-[3px] border border-line-strong flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-mist" data-dot />
                                        Manager Not Linked
                                    </span>
                                )}
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
                                oauthEnabled={discordOAuthEnabled}
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
                                initialSessionReminderEnabled={event.sessionReminderEnabled}
                                initialSessionReminderLeadMinutes={event.sessionReminderLeadMinutes}
                            />
                        </div>

                        {/* Players */}
                        <div className="space-y-3">
                            <SidebarLabel>Players</SidebarLabel>
                            {event.participants.length > 0 ? (
                                <ManageParticipants slug={event.slug} participants={manageParticipants} />
                            ) : (
                                <p className="text-xs text-mist py-1">No players have voted yet.</p>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Slots / Finalized State */}
                    <div className="lg:col-span-7 space-y-6">
                        {isFinalized && isCampaign ? (
                            /* CAMPAIGN FINALIZED STATE */
                            <>
                                <div className="p-8 rounded-card bg-surface border border-line border-t-2 border-t-yes space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-2xl font-bold text-yes mb-1">Campaign Finalized!</h2>
                                        <p className="text-mist text-sm">{finalizedSessions.length} session{finalizedSessions.length !== 1 ? 's' : ''} locked in</p>
                                    </div>
                                    <div className="space-y-2">
                                        {finalizedSessions.map((fs, i) => {
                                            const calEvent = {
                                                title: `${event.title}: Session ${i + 1}`,
                                                description: event.description ?? undefined,
                                                location: event.location ?? undefined,
                                                slug: event.slug,
                                            };
                                            const gUrl = googleCalendarUrl(calEvent, new Date(fs.timeSlot.startTime), new Date(fs.timeSlot.endTime));
                                            const oUrl = outlookCalendarUrl(calEvent, new Date(fs.timeSlot.startTime), new Date(fs.timeSlot.endTime));
                                            return (
                                                <div key={fs.id} className="flex items-center gap-3 p-3 bg-surface rounded-control border border-line-strong">
                                                    <span className="text-xs font-bold text-gold-bright bg-surface-2 rounded px-1.5 py-0.5 min-w-[28px] text-center shrink-0">
                                                        {i + 1}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <ClientDate date={fs.timeSlot.startTime} formatStr="EEEE, MMMM do" className="font-semibold text-parchment text-sm" />
                                                        <span className="text-mist text-sm"> at </span>
                                                        <ClientDate date={fs.timeSlot.startTime} formatStr="h:mm a" className="font-semibold text-parchment text-sm" />
                                                        <ClientTimezone className="ml-1.5 text-mist font-normal text-xs" />
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <a href={gUrl} target="_blank" rel="noopener noreferrer" title="Add to Google Calendar" className="text-xs px-2 py-1 rounded-control bg-surface-2 hover:bg-surface border border-line-strong text-mist hover:text-parchment transition-colors whitespace-nowrap inline-flex items-center gap-1">
                                                            <CalendarPlus className="size-3.5" aria-hidden="true" /> Google
                                                        </a>
                                                        <a href={oUrl} target="_blank" rel="noopener noreferrer" title="Add to Outlook" className="text-xs px-2 py-1 rounded-control bg-surface-2 hover:bg-surface border border-line-strong text-mist hover:text-parchment transition-colors whitespace-nowrap inline-flex items-center gap-1">
                                                            <Mail className="size-3.5" aria-hidden="true" /> Outlook
                                                        </a>
                                                        <a href={`/api/event/${event.slug}/ics?slot=${fs.timeSlot.id}`} title="Download this session as .ics" className="text-xs px-2 py-1 rounded-control bg-surface-2 hover:bg-surface border border-line-strong text-mist hover:text-parchment transition-colors whitespace-nowrap inline-flex items-center gap-1">
                                                            <Download className="size-3.5" aria-hidden="true" /> .ics
                                                        </a>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {(event.finalizedHost || event.location) && (
                                        <div className="p-4 bg-surface-2 rounded-card border border-line-strong text-sm space-y-2">
                                            {event.finalizedHost && (
                                                <div className="flex items-center gap-2 text-parchment-2">
                                                    <Home className="size-4 text-gold-bright" aria-hidden="true" />
                                                    <span>Hosted by <span className="font-semibold text-parchment">{event.finalizedHost.name}</span></span>
                                                </div>
                                            )}
                                            {event.location ? (
                                                <div className="flex items-start gap-2 text-parchment-2">
                                                    <MapPin className="size-4 mt-0.5 text-gold-bright" aria-hidden="true" />
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-medium text-mist text-xs uppercase tracking-wide">Location</div>
                                                            <EditLocationModal slug={event.slug} initialLocation={event.location} />
                                                        </div>
                                                        <div className="text-parchment">{event.location}</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-start gap-2 text-parchment-2">
                                                    <MapPin className="size-4 mt-0.5 text-gold-bright" aria-hidden="true" />
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-medium text-mist text-xs uppercase tracking-wide">Location</div>
                                                            <EditLocationModal slug={event.slug} initialLocation={null} />
                                                        </div>
                                                        <div className="text-mist italic">TBD</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Campaign Attendees */}
                                <div className="bg-surface p-6 rounded-card border border-line">
                                    <h3 className="text-lg font-semibold text-parchment-2 mb-4">Campaign Group</h3>
                                    <ul className="space-y-3 mb-4">
                                        {event.participants.filter(p => p.status === 'ACCEPTED').map(p => (
                                            <li key={p.id} className="flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-control bg-surface-2 flex items-center justify-center text-gold-bright font-bold text-xs">
                                                    {p.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="font-medium text-parchment">
                                                    {p.name}
                                                    {p.telegramId && <span className="ml-2 text-xs text-gold-bright font-normal">{p.telegramId}</span>}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                    {event.participants.some(p => p.status === 'WAITLIST') && (
                                        <div className="border-t border-line pt-4">
                                            <h3 className="text-sm font-semibold text-mist mb-3 flex items-center gap-2">
                                                Subs / Waitlist
                                                <span className="bg-maybe-bg text-maybe px-2 py-0.5 rounded text-xs border border-maybe">
                                                    {event.participants.filter(p => p.status === 'WAITLIST').length}
                                                </span>
                                            </h3>
                                            <ul className="space-y-2">
                                                {event.participants.filter(p => p.status === 'WAITLIST').map(p => (
                                                    <li key={p.id} className="flex items-center gap-3">
                                                        <div className="w-7 h-7 rounded-control bg-maybe-bg flex items-center justify-center text-maybe font-bold text-xs border border-dashed border-maybe">
                                                            {p.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div className="font-medium text-mist">{p.name}</div>
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
                                <div className="p-8 rounded-card bg-surface border border-line border-t-2 border-t-yes text-center space-y-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-yes mb-2">Event Finalized!</h2>
                                        <p className="text-parchment-2 text-lg">
                                            Playing on <br />
                                            <ClientDate date={finalizedSlot.startTime} formatStr="EEEE, MMMM do" className="font-semibold text-parchment" />
                                            <span className="text-mist"> at </span>
                                            <ClientDate date={finalizedSlot.startTime} formatStr="h:mm a" className="font-semibold text-parchment" />
                                            <ClientTimezone className="ml-1.5 text-mist font-normal text-base" />
                                        </p>


                                        {(event.finalizedHost || event.location) && (
                                            <div className="mt-4 p-4 bg-surface-2 rounded-card border border-line-strong inline-block text-left text-sm space-y-2 min-w-[250px]">
                                                {event.finalizedHost && (
                                                    <div className="flex items-center gap-2 text-parchment-2">
                                                        <Home className="size-5 text-gold-bright" aria-hidden="true" />
                                                        <span>Hosted by <span className="font-semibold text-parchment">{event.finalizedHost.name}</span></span>
                                                    </div>
                                                )}
                                                {event.location && (
                                                    <div className="flex items-start gap-2 text-parchment-2">
                                                        <MapPin className="size-5 mt-0.5 text-gold-bright" aria-hidden="true" />
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className="font-medium text-mist text-xs uppercase tracking-wide">Location</div>
                                                                <EditLocationModal slug={event.slug} initialLocation={event.location} />
                                                            </div>
                                                            <div className="text-parchment">{event.location}</div>
                                                        </div>
                                                    </div>
                                                )}
                                                {!event.location && (
                                                    <div className="flex items-start gap-2 text-parchment-2">
                                                        <MapPin className="size-5 mt-0.5 text-gold-bright" aria-hidden="true" />
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className="font-medium text-mist text-xs uppercase tracking-wide">Location</div>
                                                                <EditLocationModal slug={event.slug} initialLocation={null} />
                                                            </div>
                                                            <div className="text-mist italic">TBD</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="border-t border-line-strong pt-6">
                                        <AddToCalendar
                                            event={{
                                                title: event.title,
                                                description: event.description || undefined,
                                                location: event.location,
                                                slug: event.slug,
                                            }}
                                            slot={finalizedSlot}
                                            className="justify-center"
                                        />
                                    </div>
                                </div>

                                {/* Finalized Attendees List */}
                                <div className="bg-surface p-6 rounded-card border border-line">
                                    <h3 className="text-lg font-semibold text-parchment-2 mb-4 flex items-center justify-between">
                                        <span>Who&apos;s Going</span>
                                        <div className="flex items-center gap-2">
                                            <span className="bg-surface-2 text-mist px-2 py-1 rounded text-xs">
                                                {event.maxPlayers
                                                    ? `${finalizedSlot.votes.filter((v) => (v.preference === 'YES' || v.preference === 'MAYBE') && (!v.participant.status || v.participant.status === 'ACCEPTED')).length}/${event.maxPlayers}`
                                                    : finalizedSlot.votes.filter((v) => (v.preference === 'YES' || v.preference === 'MAYBE') && (!v.participant.status || v.participant.status === 'ACCEPTED')).length
                                                }
                                            </span>
                                        </div>
                                    </h3>

                                    <ul className="space-y-3 mb-8">
                                        {finalizedSlot.votes
                                            .filter((v) => (v.preference === 'YES' || v.preference === 'MAYBE') && (!v.participant.status || v.participant.status === 'ACCEPTED'))
                                            .map((v) => (
                                                <li key={v.participant.id} className="flex items-center gap-3">
                                                    <div className="w-7 h-7 rounded-control bg-surface-2 flex items-center justify-center text-gold-bright font-bold text-xs">
                                                        {v.participant.name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-parchment">
                                                            {v.participant.name}
                                                            {v.participant.telegramId && <span className="ml-2 text-xs text-gold-bright font-normal">{v.participant.telegramId}</span>}
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                    </ul>

                                    {finalizedSlot.votes.some((v) => v.participant.status === 'WAITLIST') && (
                                        <div className="border-t border-line pt-6">
                                            <h3 className="text-lg font-semibold text-parchment-2 mb-4 flex items-center justify-between">
                                                <span>Waitlist</span>
                                                <span className="bg-maybe-bg text-maybe px-2 py-1 rounded text-xs border border-maybe">
                                                    {finalizedSlot.votes.filter((v) => v.participant.status === 'WAITLIST').length}
                                                </span>
                                            </h3>
                                            <ul className="space-y-3">
                                                {finalizedSlot.votes
                                                    .filter((v) => v.participant.status === 'WAITLIST')
                                                    .map((v) => (
                                                        <li key={v.participant.id} className="flex items-center gap-3">
                                                            <div className="w-7 h-7 rounded-control bg-maybe-bg flex items-center justify-center text-maybe font-bold text-xs border border-dashed border-maybe">
                                                                {v.participant.name.substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-mist">
                                                                    {v.participant.name}
                                                                    {v.participant.telegramId && <span className="ml-2 text-xs text-maybe font-normal">{v.participant.telegramId}</span>}
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
                            <div className="p-8 rounded-card bg-surface border border-no text-center space-y-6">
                                <div className="w-16 h-16 bg-no-bg rounded-card flex items-center justify-center mx-auto mb-4">
                                    <Ban className="size-8 text-no" aria-hidden="true" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-no mb-2">Event Cancelled</h2>
                                    <p className="text-mist text-lg">
                                        You have cancelled this event via the manager controls.
                                    </p>
                                    <p className="text-mist text-sm mt-2">
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
                                            <h2 className="text-xl font-semibold text-parchment">Candidate Sessions</h2>
                                            <p className="text-xs text-mist mt-0.5">Click a group to select it and finalize</p>
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
                                                    .filter((v) => v.preference === 'YES' || v.preference === 'MAYBE')
                                                    .map((v) => ({
                                                        participantId: v.participantId,
                                                        preference: v.preference,
                                                        canHost: v.canHost ?? false,
                                                        participant: { id: v.participant.id, name: v.participant.name },
                                                    })),
                                            })),
                                        }))}
                                    />

                                    <ManageSlots slug={event.slug} slots={manageSlotRows} />
                                </div>
                            ) : (
                                /* ONE-SHOT VOTING: sorted slot cards */
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-xl font-semibold text-parchment">Proposed Slots</h2>
                                        <span className="text-xs font-mono text-mist uppercase tracking-wider">Best Options First</span>
                                    </div>

                                    <ManagerVoteWarning
                                        eventId={event.id}
                                        participants={participantIds}
                                        slug={event.slug}
                                    />

                                    <div className="grid gap-2">
                                        {slots.length === 0 ? (
                                            <div className="p-8 text-center text-mist border border-dashed border-line rounded-card">
                                                No time slots proposed yet.
                                            </div>
                                        ) : slots.map((slot, index) => {
                                            const totalParticipants = event.participants.length;
                                            const yesVoters = slot.votes.filter((v) => v.preference === 'YES');
                                            const maybeVoters = slot.votes.filter((v) => v.preference === 'MAYBE');
                                            const noVoters = slot.votes.filter((v) => v.preference === 'NO');
                                            const unvotedCount = Math.max(0, totalParticipants - yesVoters.length - maybeVoters.length - noVoters.length);

                                            const cardClass = slot.perfect
                                                ? "border-yes bg-yes-bg"
                                                : !slot.viable
                                                ? "border-line border-dashed bg-surface"
                                                : !slot.hasHost
                                                ? "border-maybe bg-surface"
                                                : "border-line-strong bg-surface";

                                            return (
                                                <div key={slot.id} className={`rounded-card border p-4 transition-all ${cardClass}`}>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap mb-2">
                                                                <span className="font-display font-semibold text-parchment text-base">
                                                                    <ClientDate date={slot.startTime} formatStr="EEE, MMM d @ h:mm a" />
                                                                    <ClientTimezone className="ml-1 text-mist font-normal" />
                                                                </span>
                                                                {slot.perfect && (
                                                                    <span className="text-xs font-medium text-yes bg-yes-bg px-2 py-0.5 rounded-[3px]">Perfect</span>
                                                                )}
                                                                {!slot.hasHost && (
                                                                    <span className="text-xs font-medium text-maybe bg-maybe-bg px-2 py-0.5 rounded-[3px]">No host</span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1 flex-wrap">
                                                                {yesVoters.map((v) => (
                                                                    <span key={v.participant.id} title={v.participant.name} data-dot className="w-3 h-3 rounded-full bg-yes cursor-help shrink-0" />
                                                                ))}
                                                                {maybeVoters.map((v) => (
                                                                    <span key={v.participant.id} title={v.participant.name} data-dot className="w-3 h-3 rounded-full bg-maybe cursor-help shrink-0" />
                                                                ))}
                                                                {noVoters.map((v) => (
                                                                    <span key={v.participant.id} title={v.participant.name} data-dot className="w-3 h-3 rounded-full bg-no cursor-help shrink-0" />
                                                                ))}
                                                                {Array.from({ length: unvotedCount }).map((_, i) => (
                                                                    <span key={`u-${i}`} data-dot className="w-3 h-3 rounded-full bg-line-strong shrink-0" />
                                                                ))}
                                                                <span className="ml-2 text-xs text-mist">
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

                                    <ManageSlots slug={event.slug} slots={manageSlotRows} />
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
            <span className="text-xs font-semibold text-mist uppercase tracking-widest whitespace-nowrap">{children}</span>
            <div className="flex-1 h-px bg-line" />
        </div>
    );
}

"use client";

import { useEventHistory, VisitedEvent } from "@/hooks/useEventHistory";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, User as UserIcon, Calendar, Clock, RefreshCw, Send, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ClientDate } from "@/components/ClientDate";
import { sendGlobalMagicLink } from "@/features/auth/server/magic-link";
import { linkParticipant, unlinkParticipant } from "@/features/auth/server/participant-link";
import { SyncBadge } from "@/components/SyncBadge";


import { DiscordLoginSender } from "@/features/discord/ui/DiscordLoginSender";

interface ServerEvent {
    slug: string;
    title: string;
    role: 'MANAGER' | 'PARTICIPANT';
    lastVisited: string; // ISO string
    eventId?: number;
    participantId?: number;
    sources?: ('telegram' | 'discord')[];
    status?: string;
    scheduledDate?: string;
}

/**
 * @component ManagerBadge
 * @description Pill marking an event's `role: 'MANAGER'`, using the same geometry
 * as `SyncBadge` but an indigo palette and a static (non-pulsing) dot, since it
 * reflects a role rather than a live sync connection. Distinct from the sync
 * badges: an event can show this alongside Telegram/Discord Synced badges, or
 * alone if the manager record has no linked participant identity yet.
 */
function ManagerBadge() {
    return (
        <span className="text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 bg-indigo-900/40 text-indigo-300 rounded-full border border-indigo-800 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Manager
        </span>
    );
}

/**
 * @component ConnectBadge
 * @description Hollow "empty slot" pill shown in place of a SyncBadge when a
 * platform isn't synced yet. Same pill geometry/typography as SyncBadge, but
 * dashed/muted to read as an action rather than a status, and it tints toward
 * the platform color on hover to invite the click.
 */
function ConnectBadge({ platform, href, newTab, onClick }: { platform: 'telegram' | 'discord'; href: string; newTab?: boolean; onClick?: () => void }) {
    const hoverClass = platform === 'telegram'
        ? 'hover:border-green-700 hover:text-green-400'
        : 'hover:border-[#5865F2]/70 hover:text-[#5865F2]';

    return (
        <a
            href={href}
            onClick={onClick}
            target={newTab ? "_blank" : undefined}
            rel={newTab ? "noopener noreferrer" : undefined}
            className={`text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 bg-transparent text-slate-400 rounded-full border border-dashed border-slate-600 flex items-center gap-1 cursor-pointer transition-colors ${hoverClass}`}
        >
            <span className="w-1.5 h-1.5 rounded-full border border-slate-500" />
            Connect {platform === 'telegram' ? 'Telegram' : 'Discord'}
        </a>
    );
}

/**
 * @component NotLinkedBadge
 * @description Per-event "not linked yet" pill for a platform the browser IS synced
 * with but this event isn't linked to. Same dashed geometry as ConnectBadge, but a
 * popover trigger (not a link) so it flows into the card's shared link menu. When the
 * event has no participant row to link (`disabled`), it greys out and surfaces `hint`
 * as a tooltip instead of opening the menu.
 */
function NotLinkedBadge({ platform, disabled, hint, onClick }: { platform: 'telegram' | 'discord'; disabled?: boolean; hint?: string; onClick?: (e: React.MouseEvent) => void }) {
    const hoverClass = platform === 'telegram'
        ? 'hover:border-green-700 hover:text-green-400'
        : 'hover:border-[#5865F2]/70 hover:text-[#5865F2]';

    return (
        <span
            role={disabled ? undefined : 'button'}
            tabIndex={disabled ? undefined : 0}
            onClick={disabled ? undefined : onClick}
            title={disabled ? hint : undefined}
            className={`text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 bg-transparent rounded-full border border-dashed flex items-center gap-1 transition-colors ${disabled ? 'text-slate-600 border-slate-700/60 opacity-60 cursor-not-allowed' : `text-slate-400 border-slate-600 cursor-pointer ${hoverClass}`}`}
        >
            <span className="w-1.5 h-1.5 rounded-full border border-slate-500" />
            {platform === 'telegram' ? 'Telegram' : 'Discord'} Not Linked
        </span>
    );
}

/**
 * @component LinkPopover
 * @description Hand-rolled popover (no dependency): a full-screen invisible backdrop
 * that closes the menu on click-outside, plus an anchored menu box. Clicks inside the
 * menu are stopped from bubbling to the backdrop or to a wrapping <Link>.
 */
function LinkPopover({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
    return (
        <>
            <div
                className="fixed inset-0 z-40"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
            />
            <div
                className="absolute z-50 top-full left-0 mt-1 min-w-[190px] bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1"
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </>
    );
}

/** Single action row inside a LinkPopover. Disabled items show `hint` as a tooltip. */
function PopoverItem({ label, disabled, hint, onClick }: { label: string; disabled?: boolean; hint?: string; onClick: (e: React.MouseEvent) => void }) {
    return (
        <button
            type="button"
            disabled={disabled}
            title={disabled ? hint : undefined}
            onClick={onClick}
            className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
        >
            {label}
        </button>
    );
}

const LINK_FIRST_HINT = "Vote on this event first to link it";
const SYNC_FIRST_HINT = "Sync this browser first to link events";

/**
 * @component EventCard
 * @description One row in the "Your Events" list. Owns the popover/pending/message
 * state for that row's sync badges so link/unlink actions can be wired up without
 * hooks inside the parent's `.map()`.
 *
 * participantId resolution:
 * - Server-resolved events (role matched the caller's chatId/discordId) carry
 *   `serverEvent.participantId` directly.
 * - Device-only events (no server match yet, e.g. the row is unclaimed) fall back to
 *   the locally-stored `tabletop_participant_<eventId>` written when the user voted
 *   in this browser. `eventId` itself comes from local history (populated by
 *   `validateHistory`) or the server event.
 * - If neither resolves, linking/unlinking that platform is disabled with a hint.
 */
function EventCard({ event, serverEvent, isTelegramSynced, isDiscordSynced }: {
    event: VisitedEvent;
    serverEvent?: ServerEvent;
    isTelegramSynced?: boolean;
    isDiscordSynced?: boolean;
}) {
    const router = useRouter();
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [pending, setPending] = useState(false);
    const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const sources = serverEvent?.sources ?? [];
    const eventId = event.eventId ?? serverEvent?.eventId;
    const participantId = serverEvent?.participantId ?? (
        eventId ? (Number(localStorage.getItem(`tabletop_participant_${eventId}`)) || undefined) : undefined
    );
    const canLink = isTelegramSynced || isDiscordSynced;

    const closePopover = () => setPopoverOpen(false);
    const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

    const toggle = (e: React.MouseEvent) => {
        stop(e);
        if (pending) return;
        setPopoverOpen(prev => !prev);
    };

    /** Shared badge trigger for sync-status pills: opens the card's one popover, or
     *  reads as a hint-only tooltip when neither platform is synced. The Manager tag is
     *  intentionally NOT a trigger — it's a role indicator, not a link control. */
    const badgeTrigger = (variant: 'telegram' | 'discord' | 'device') => (
        <span
            key={variant}
            onClick={canLink ? toggle : undefined}
            className={canLink ? "cursor-pointer inline-flex" : "inline-flex"}
            role={canLink ? "button" : undefined}
            tabIndex={canLink ? 0 : undefined}
            title={!canLink ? SYNC_FIRST_HINT : undefined}
        >
            <SyncBadge variant={variant} />
        </span>
    );

    const handleAction = (action: 'link' | 'unlink', platform: 'telegram' | 'discord') => async (e: React.MouseEvent) => {
        stop(e);
        if (!participantId || pending) return;
        closePopover();
        setPending(true);
        setActionMsg(null);
        const res = action === 'link'
            ? await linkParticipant({ slug: event.slug, participantId, platform })
            : await unlinkParticipant({ slug: event.slug, participantId, platform });
        setPending(false);
        if ('error' in res) {
            setActionMsg({ type: 'error', text: res.error });
        } else {
            setActionMsg({ type: 'success', text: res.message || (action === 'link' ? 'Linked.' : 'Unlinked.') });
            router.refresh();
        }
    };

    return (
        <Link
            href={`/e/${event.slug}`}
            className="group block p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-indigo-500/30 transition-all"
        >
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="font-semibold text-lg group-hover:text-indigo-300 transition-colors flex items-center gap-2">
                        {event.title}
                        {event.status === 'CANCELLED' && (
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-red-900/40 text-red-400 rounded-full border border-red-800">
                                Cancelled
                            </span>
                        )}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono mt-1">
                        {event.scheduledDate
                            ? <ClientDate date={event.scheduledDate} formatStr="MMM d, yyyy" />
                            : (event.status === 'CANCELLED'
                                ? <>Original Date: <ClientDate date={event.lastVisited} formatStr="MMM d" /></>
                                : "Draft / Scheduling...")
                        }
                    </p>
                    <div className="relative flex flex-wrap gap-1.5 mt-2">
                        {serverEvent ? (
                            <>
                                {sources.map(badgeTrigger)}
                                {/* "Not linked" pills for platforms this browser is synced
                                    with but the event isn't linked to — the intuitive place
                                    to start a link, disabled with a hint until you've voted. */}
                                {isTelegramSynced && !sources.includes('telegram') && (
                                    <NotLinkedBadge
                                        key="telegram-unlinked"
                                        platform="telegram"
                                        disabled={!participantId}
                                        hint={LINK_FIRST_HINT}
                                        onClick={toggle}
                                    />
                                )}
                                {isDiscordSynced && !sources.includes('discord') && (
                                    <NotLinkedBadge
                                        key="discord-unlinked"
                                        platform="discord"
                                        disabled={!participantId}
                                        hint={LINK_FIRST_HINT}
                                        onClick={toggle}
                                    />
                                )}
                                {serverEvent.role === 'MANAGER' && <ManagerBadge />}
                            </>
                        ) : badgeTrigger('device')}
                        {popoverOpen && canLink && (
                            <LinkPopover onClose={closePopover}>
                                {isTelegramSynced && (
                                    <PopoverItem
                                        label={sources.includes('telegram') ? 'Unlink from Telegram' : 'Link to Telegram'}
                                        disabled={!participantId}
                                        hint={LINK_FIRST_HINT}
                                        onClick={handleAction(sources.includes('telegram') ? 'unlink' : 'link', 'telegram')}
                                    />
                                )}
                                {isDiscordSynced && (
                                    <PopoverItem
                                        label={sources.includes('discord') ? 'Unlink from Discord' : 'Link to Discord'}
                                        disabled={!participantId}
                                        hint={LINK_FIRST_HINT}
                                        onClick={handleAction(sources.includes('discord') ? 'unlink' : 'link', 'discord')}
                                    />
                                )}
                            </LinkPopover>
                        )}
                    </div>
                    {actionMsg && (
                        <p className={`text-xs mt-1.5 ${actionMsg.type === 'success' ? 'text-green-400' : 'text-amber-400'}`}>
                            {actionMsg.text}
                        </p>
                    )}
                </div>
                <ArrowRightIcon className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition-colors" />
            </div>
        </Link>
    );
}

/**
 * @component ProfileDashboard
 * @description Client-side dashboard for authenticated/identified users.
 *
 * Core Logic:
 * 1. Hybrid Data Source:
 *    - Merges `serverEvents` (fetched via persistent HTTP-only cookie).
 *    - Merges `localStorage` history (anonymous/device-based history).
 * 2. Identity Sync:
 *    - If server events contain `participantId`, it restores `localStorage` keys.
 *    - This allows a user to "log in" via Magic Link on a new device and immediately regain voting rights.
 * 3. Recovery:
 *    - Provides a "Magic Link" request form to elevate a session from Anonymous -> Authenticated.
 */
export function ProfileDashboard({ serverEvents = [], isTelegramSynced, isDiscordSynced, serverUserName, telegramConnectUrl }: { serverEvents?: ServerEvent[], isTelegramSynced?: boolean, isDiscordSynced?: boolean, serverUserName?: string, telegramConnectUrl?: string | null }) {
    const { history, validateHistory, bulkMerge } = useEventHistory();
    const [userName, setUserName] = useState("");
    const [telegramConnectClicked, setTelegramConnectClicked] = useState(false);

    // Lookup of server-resolved events by slug, used to render per-event sync badges.
    const serverEventsBySlug = useMemo(() => {
        return new Map(serverEvents.map(e => [e.slug, e]));
    }, [serverEvents]);

    // Recovery Form State
    const [handle, setHandle] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string, deepLink?: string } | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const localName = localStorage.getItem('tabletop_username');
            
            // Intent: If the server knows their name (from Magic Link / DB), 
            // and local storage is empty OR we want to force-sync the server's truth:
            if (serverUserName && (!localName || localName === "Guest")) {
                localStorage.setItem('tabletop_username', serverUserName);
                setUserName(serverUserName);
            } else {
                setUserName(localName || "Guest");
            }
            validateHistory();
        }
    }, [validateHistory, serverUserName]);

    // Sync Server Events & Identities to Local Storage
    useEffect(() => {
        if (serverEvents.length > 0 && bulkMerge) {
            // 1. History Sync
            const toSync = serverEvents.map(e => ({
                slug: e.slug,
                title: e.title,
                lastVisited: new Date(e.lastVisited).getTime(),
                status: e.status,
                scheduledDate: e.scheduledDate,
                eventId: e.eventId
            }));
            bulkMerge(toSync);

            // 2. Identity Sync (Bulk restore voting status)
            // Intent: Re-hydrate local storage with participant IDs so the client "knows" who it is for each event
            serverEvents.forEach(e => {
                if (e.eventId && e.participantId) {
                    const key = `tabletop_participant_${e.eventId}`;
                    localStorage.setItem(key, e.participantId.toString());
                }
            });
        }
    }, [serverEvents, bulkMerge]);

    const handleRecovery = async () => {
        if (!handle) return;
        setLoading(true);
        setMsg(null);

        const res = await sendGlobalMagicLink(handle);

        if (res.success) {
            setMsg({ type: 'success', text: res.message || "Link sent!" });
        } else if (res.deepLink) {
            setMsg({ type: 'error', text: res.message || "Verification needed", deepLink: res.deepLink });
        } else {
            setMsg({ type: 'error', text: res.error || "Failed to find events" });
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-12">
            <div className="max-w-3xl mx-auto space-y-8">
                <Link href="/" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors mb-4">
                    <ArrowLeft className="w-4 h-4" /> Back Home
                </Link>

                <div className="flex items-center gap-4 pb-8 border-b border-slate-800">
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400">
                        <UserIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-100">
                            Hello, {userName}
                        </h1>
                        <p className="text-slate-400 mb-2">Welcome to your event dashboard.</p>
                        <div className="flex flex-wrap gap-2">
                            {isTelegramSynced ? (
                                <SyncBadge variant="telegram" />
                            ) : telegramConnectUrl ? (
                                <ConnectBadge
                                    platform="telegram"
                                    href={telegramConnectUrl}
                                    newTab
                                    onClick={() => setTelegramConnectClicked(true)}
                                />
                            ) : null}
                            {isDiscordSynced ? (
                                <SyncBadge variant="discord" />
                            ) : (
                                <ConnectBadge platform="discord" href="/api/auth/discord?flow=login&returnTo=/profile" />
                            )}
                        </div>
                        {telegramConnectClicked && !isTelegramSynced && (
                            <p className="text-xs text-slate-500 mt-2">Check your Telegram DMs for a login link.</p>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-slate-200 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-indigo-400" />
                            Your Events
                        </h2>
                    </div>

                    {history.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                            <p>You haven&apos;t visited any events yet.</p>
                            <Link href="/new" className="mt-4 inline-block px-4 py-2 bg-indigo-600 rounded-lg text-white text-sm font-medium hover:bg-indigo-500 transition-colors">
                                Create an Event
                            </Link>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {history.map(event => (
                                <EventCard
                                    key={event.slug}
                                    event={event}
                                    serverEvent={serverEventsBySlug.get(event.slug)}
                                    isTelegramSynced={isTelegramSynced}
                                    isDiscordSynced={isDiscordSynced}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Magic Link Recovery Section */}
                <div className="pt-8 border-t border-slate-800">
                    <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-slate-400" />
                        Sync & Recover
                    </h3>

                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Telegram Panel */}
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
                            <h4 className="text-md font-semibold text-slate-200 mb-2 flex items-center gap-2">
                                <span className="text-sky-400">Telegram</span> Sync
                            </h4>
                            <p className="text-slate-400 text-sm mb-4">
                                Enter your Telegram Handle to receive a Magic Link.
                                <br />
                                <span className="text-xs text-slate-500 italic">(Requires you to have used your handle during voting previously)</span>
                            </p>

                            <div className="flex flex-col gap-3">
                                <input
                                    type="text"
                                    placeholder="@username"
                                    value={handle}
                                    onChange={(e) => setHandle(e.target.value)}
                                    className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500 outline-none"
                                />
                                <button
                                    onClick={handleRecovery}
                                    disabled={loading || !handle}
                                    className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    Send Link
                                </button>
                            </div>

                            {msg && (
                                <div className={`mt-4 p-3 rounded-lg text-sm border ${msg.type === 'success'
                                    ? 'bg-green-900/20 border-green-800 text-green-300'
                                    : 'bg-amber-900/20 border-amber-800 text-amber-300'
                                    }`}>
                                    <p className="font-medium mb-1">{msg.text}</p>
                                    {msg.deepLink && (
                                        <a
                                            href={msg.deepLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-2 inline-flex items-center gap-2 text-amber-300 hover:text-white underline"
                                        >
                                            <Lock className="w-3 h-3" />
                                            Open Telegram to Verify
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Discord Panel */}
                        <DiscordLoginSender />
                    </div>
                </div>

            </div >
        </div >
    )
}

function ArrowRightIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
        </svg>
    )
}

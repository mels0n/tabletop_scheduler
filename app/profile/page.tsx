import { Metadata } from "next";
import prisma from "@/shared/lib/prisma";
import { cookies } from "next/headers";
import { getBotUsername } from "@/features/telegram/lib/telegram-client";
import { ProfileDashboard } from "./ProfileDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    robots: "noindex, nofollow",
};

/**
 * @function ProfilePage
 * @description Server-side wrapper for the Profile Dashboard.
 *
 * Responsibilities:
 * 1. Checks for a persistent `tabletop_user_chat_id` cookie.
 * 2. If present, fetches all associated events from the database:
 *    - Events Managed (where managerChatId matches).
 *    - Events Participated (via Participant relation).
 * 3. Maps and de-duplicates events (Manager role supersedes Participant role for
 *    the `role` field, but sync badge `sources` and `participantId` always come
 *    from the participant queries, never the manager ones).
 * 4. Hydrates the Client Component `ProfileDashboard` with this trusted server data.
 */
export default async function ProfilePage() {
    // Security: Only read the HTTP-only cookie.
    const cookieStore = cookies();
    const telegramChatId = cookieStore.get("tabletop_user_chat_id")?.value;
    const discordUserId = cookieStore.get("tabletop_user_discord_id")?.value;
    const discordUserName = cookieStore.get("tabletop_user_discord_name")?.value;

    let serverEvents: any[] = [];
    let serverUserName: string | null = discordUserName || null;
    const eventMap = new Map();

    const resolveScheduledDate = (e: { finalizedSlotId: number | null, timeSlots: { id: number, startTime: Date }[], finalizedSessions: { timeSlot: { startTime: Date } }[] }): string | undefined => {
        const finalizedSlot = e.timeSlots.find(s => s.id === e.finalizedSlotId);
        if (finalizedSlot) return finalizedSlot.startTime.toISOString();
        if (e.finalizedSessions.length > 0) {
            const sorted = [...e.finalizedSessions].sort((a, b) => a.timeSlot.startTime.getTime() - b.timeSlot.startTime.getTime());
            return sorted[0].timeSlot.startTime.toISOString();
        }
        return undefined;
    };

    const fetchEvents = async (chatId: string | undefined, discordId: string | undefined) => {
        // Issue all four applicable queries concurrently instead of one strict
        // `await` chain: on a cold Vercel + Supabase start each round trip adds
        // real latency, and none of these reads depend on each other. The MERGE
        // below still runs in the exact original sequential order (managed
        // Telegram, then managed Discord, then participated Telegram, then
        // participated Discord) because eventMap construction is order-dependent
        // (see fetchEvents doc).
        const [managed, managedDiscord, participated, participatedDiscord] = await Promise.all([
            chatId
                ? prisma.event.findMany({
                    where: { managerChatId: chatId },
                    select: {
                        id: true,
                        slug: true,
                        title: true,
                        updatedAt: true,
                        status: true,
                        finalizedSlotId: true,
                        timeSlots: { select: { id: true, startTime: true } },
                        finalizedSessions: { select: { timeSlot: { select: { startTime: true } } } }
                    },
                    orderBy: { updatedAt: 'desc' }
                })
                : Promise.resolve([]),
            discordId
                ? prisma.event.findMany({
                    where: { managerDiscordId: discordId },
                    select: {
                        id: true,
                        slug: true,
                        title: true,
                        updatedAt: true,
                        status: true,
                        finalizedSlotId: true,
                        timeSlots: { select: { id: true, startTime: true } },
                        finalizedSessions: { select: { timeSlot: { select: { startTime: true } } } }
                    },
                    orderBy: { updatedAt: 'desc' }
                })
                : Promise.resolve([]),
            chatId
                ? prisma.participant.findMany({
                    where: { chatId: chatId },
                    include: {
                        event: {
                            select: {
                                id: true,
                                slug: true,
                                title: true,
                                updatedAt: true,
                                status: true,
                                finalizedSlotId: true,
                                timeSlots: { select: { id: true, startTime: true } },
                                finalizedSessions: { select: { timeSlot: { select: { startTime: true } } } }
                            }
                        }
                    },
                    orderBy: { event: { updatedAt: 'desc' } }
                })
                : Promise.resolve([]),
            discordId
                ? prisma.participant.findMany({
                    where: { discordId: discordId },
                    include: {
                        event: {
                            select: {
                                id: true,
                                slug: true,
                                title: true,
                                updatedAt: true,
                                status: true,
                                finalizedSlotId: true,
                                timeSlots: { select: { id: true, startTime: true } },
                                finalizedSessions: { select: { timeSlot: { select: { startTime: true } } } }
                            }
                        }
                    },
                    orderBy: { event: { updatedAt: 'desc' } }
                })
                : Promise.resolve([]),
        ]);

        // 1. Merge Managed Events (Telegram)
        managed.forEach(e => {
            // Manager role only, never a sync source: sync badges are derived
            // purely from the participant queries below (see fetchEvents doc).
            eventMap.set(e.slug, {
                slug: e.slug,
                title: e.title,
                role: 'MANAGER',
                lastVisited: e.updatedAt.toISOString(),
                eventId: e.id,
                sources: [],
                status: e.status,
                scheduledDate: resolveScheduledDate(e)
            });
        });

        // 2. Merge Managed Events (Discord)
        managedDiscord.forEach(e => {
            const existing = eventMap.get(e.slug);
            // Manager role only, never a sync source (see the Telegram pass above).
            // Preserve whatever sources the earlier pass already set instead of
            // clobbering them.
            const sources = existing ? existing.sources : [];
            eventMap.set(e.slug, {
                slug: e.slug,
                title: e.title,
                role: 'MANAGER',
                lastVisited: e.updatedAt.toISOString(),
                eventId: e.id,
                sources,
                status: e.status,
                scheduledDate: resolveScheduledDate(e)
            });
        });

        // 3. Merge Participated Events (Telegram)
        if (participated.length > 0 && !serverUserName) {
            serverUserName = participated[0].name;
        }

        participated.forEach(p => {
            const existing = eventMap.get(p.event.slug);
            if (existing?.role === 'MANAGER') {
                // Manager role supersedes Participant for the `role` field, but sync
                // badges and participantId (used to link/unlink) always come from the
                // participant row when one exists.
                existing.participantId = p.id;
                if (!existing.sources.includes('telegram')) existing.sources.push('telegram');
            } else {
                const sources = existing ? Array.from(new Set([...existing.sources, 'telegram'])) : ['telegram'];
                eventMap.set(p.event.slug, {
                    slug: p.event.slug,
                    title: p.event.title,
                    role: 'PARTICIPANT',
                    lastVisited: p.event.updatedAt.toISOString(),
                    eventId: p.event.id,
                    participantId: p.id,
                    sources,
                    status: p.event.status,
                    scheduledDate: resolveScheduledDate(p.event)
                });
            }
        });

        // 4. Merge Participated Events (Discord)
        if (participatedDiscord.length > 0 && !serverUserName) {
            serverUserName = participatedDiscord[0].name;
        }

        participatedDiscord.forEach(p => {
            const existing = eventMap.get(p.event.slug);
            if (existing?.role === 'MANAGER') {
                // Manager role supersedes Participant for the `role` field, but sync
                // badges and participantId (used to link/unlink) always come from the
                // participant row when one exists.
                existing.participantId = p.id;
                if (!existing.sources.includes('discord')) existing.sources.push('discord');
            } else {
                const sources = existing ? Array.from(new Set([...existing.sources, 'discord'])) : ['discord'];
                eventMap.set(p.event.slug, {
                    slug: p.event.slug,
                    title: p.event.title,
                    role: 'PARTICIPANT',
                    lastVisited: p.event.updatedAt.toISOString(),
                    eventId: p.event.id,
                    participantId: p.id,
                    sources,
                    status: p.event.status,
                    scheduledDate: resolveScheduledDate(p.event)
                });
            }
        });
    };

    // Kick off the bot username lookup (needed for the "Connect Telegram" pill, see
    // below) alongside the event queries instead of after them: it's independent of
    // fetchEvents, and getBotUsername never throws (returns null on failure), so it's
    // safe to start eagerly without a try/catch here. Preserves the original condition
    // exactly: only actually called when `!telegramChatId` and the token is set.
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const botUsernamePromise: Promise<string | null> = (!telegramChatId && botToken)
        ? getBotUsername(botToken)
        : Promise.resolve(null);

    try {
        await fetchEvents(telegramChatId, discordUserId);
        // Sort by recency
        serverEvents = Array.from(eventMap.values()).sort((a, b) => new Date(b.lastVisited).getTime() - new Date(a.lastVisited).getTime());
    } catch (e) {
        console.error("Failed to fetch server events", e);
    }

    // Resolve the bot username server-side so the "Connect Telegram" pill can deep-link
    // straight to `https://t.me/<bot>?start=login`. Hide the pill entirely if the token
    // is missing or the Telegram API lookup fails.
    let telegramConnectUrl: string | null = null;
    if (!telegramChatId) {
        const botUsername = await botUsernamePromise;
        telegramConnectUrl = botUsername ? `https://t.me/${botUsername}?start=login` : null;
    }

    return (
        <ProfileDashboard
            serverEvents={serverEvents}
            isTelegramSynced={!!telegramChatId}
            isDiscordSynced={!!discordUserId}
            serverUserName={serverUserName || undefined}
            telegramConnectUrl={telegramConnectUrl}
        />
    );
}

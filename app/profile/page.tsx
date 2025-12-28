import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { ProfileDashboard } from "./ProfileDashboard";

export const dynamic = "force-dynamic";

/**
 * @function ProfilePage
 * @description Server-side wrapper for the Profile Dashboard.
 *
 * Responsibilities:
 * 1. Checks for a persistent `tabletop_user_chat_id` cookie.
 * 2. If present, fetches all associated events from the database:
 *    - Events Managed (where managerChatId matches).
 *    - Events Participated (via Participant relation).
 * 3. Maps and de-duplicates events (Manager role supersedes Participant role).
 * 4. Hydrates the Client Component `ProfileDashboard` with this trusted server data.
 */
export default async function ProfilePage() {
    // Security: Only read the HTTP-only cookie.
    const cookieStore = cookies();
    const telegramChatId = cookieStore.get("tabletop_user_chat_id")?.value;
    const discordUserId = cookieStore.get("tabletop_user_discord_id")?.value;

    let serverEvents: any[] = [];
    const eventMap = new Map();

    const fetchEvents = async (chatId: string | undefined, discordId: string | undefined) => {
        // 1. Fetch Managed Events (Telegram)
        if (chatId) {
            const managed = await prisma.event.findMany({
                where: { managerChatId: chatId },
                select: { id: true, slug: true, title: true, updatedAt: true },
                orderBy: { updatedAt: 'desc' }
            });
            managed.forEach(e => eventMap.set(e.slug, {
                slug: e.slug,
                title: e.title,
                role: 'MANAGER',
                lastVisited: e.updatedAt.toISOString(),
                source: 'telegram'
            }));
        }

        // 2. Fetch Managed Events (Discord)
        if (discordId) {
            const managedDiscord = await prisma.event.findMany({
                where: { managerDiscordId: discordId },
                select: { id: true, slug: true, title: true, updatedAt: true },
                orderBy: { updatedAt: 'desc' }
            });
            managedDiscord.forEach(e => eventMap.set(e.slug, {
                slug: e.slug,
                title: e.title,
                role: 'MANAGER',
                lastVisited: e.updatedAt.toISOString(),
                source: 'discord'
            }));
        }

        // 3. Fetch Participated Events (Telegram)
        if (chatId) {
            const participated = await prisma.participant.findMany({
                where: { chatId: chatId },
                include: { event: { select: { id: true, slug: true, title: true, updatedAt: true } } },
                orderBy: { event: { updatedAt: 'desc' } }
            });
            participated.forEach(p => {
                const existing = eventMap.get(p.event.slug);
                // Manager role takes precedence
                if (!existing || existing.role !== 'MANAGER') {
                    eventMap.set(p.event.slug, {
                        slug: p.event.slug,
                        title: p.event.title,
                        role: 'PARTICIPANT',
                        lastVisited: p.event.updatedAt.toISOString(),
                        eventId: p.event.id,
                        participantId: p.id,
                        source: 'telegram'
                    });
                }
            });
        }

        // 4. Fetch Participated Events (Discord)
        if (discordId) {
            const participatedDiscord = await prisma.participant.findMany({
                where: { discordId: discordId },
                include: { event: { select: { id: true, slug: true, title: true, updatedAt: true } } },
                orderBy: { event: { updatedAt: 'desc' } }
            });
            participatedDiscord.forEach(p => {
                const existing = eventMap.get(p.event.slug);
                if (!existing || existing.role !== 'MANAGER') {
                    eventMap.set(p.event.slug, {
                        slug: p.event.slug,
                        title: p.event.title,
                        role: 'PARTICIPANT',
                        lastVisited: p.event.updatedAt.toISOString(),
                        eventId: p.event.id,
                        participantId: p.id,
                        source: 'discord'
                    });
                }
            });
        }
    };

    try {
        await fetchEvents(telegramChatId, discordUserId);
        // Sort by recency
        serverEvents = Array.from(eventMap.values()).sort((a, b) => new Date(b.lastVisited).getTime() - new Date(a.lastVisited).getTime());
    } catch (e) {
        console.error("Failed to fetch server events", e);
    }

    return <ProfileDashboard serverEvents={serverEvents} isTelegramSynced={!!telegramChatId} isDiscordSynced={!!discordUserId} />;
}

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
    const userChatId = cookieStore.get("tabletop_user_chat_id")?.value;

    let serverEvents: any[] = [];

    if (userChatId) {
        try {
            // 1. Fetch Managed Events
            const managed = await prisma.event.findMany({
                where: { managerChatId: userChatId },
                select: { slug: true, title: true, updatedAt: true },
                orderBy: { updatedAt: 'desc' }
            });

            // 2. Fetch Participated Events
            // Intent: Find all events where this user has voted/interacted.
            const participated = await prisma.participant.findMany({
                where: { chatId: userChatId },
                include: { event: { select: { id: true, slug: true, title: true, updatedAt: true } } },
                orderBy: { event: { updatedAt: 'desc' } }
            });

            const managedMapped = managed.map(e => ({
                slug: e.slug,
                title: e.title,
                role: 'MANAGER',
                lastVisited: e.updatedAt.toISOString()
            }));

            const participatedMapped = participated.map(p => ({
                slug: p.event.slug,
                title: p.event.title,
                role: 'PARTICIPANT',
                lastVisited: p.event.updatedAt.toISOString(),
                // Identity Payload: Used by client to restore voting rights on this device.
                eventId: p.event.id,
                participantId: p.id
            }));

            // Merge and Dedupe (Manager role takes precedence)
            const map = new Map();
            [...participatedMapped, ...managedMapped].forEach(e => {
                if (map.has(e.slug)) {
                    if (e.role === 'MANAGER') map.set(e.slug, e);
                } else {
                    map.set(e.slug, e);
                }
            });

            serverEvents = Array.from(map.values());

        } catch (e) {
            console.error("Failed to fetch server events", e);
        }
    }

    return <ProfileDashboard serverEvents={serverEvents} />;
}

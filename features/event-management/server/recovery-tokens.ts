import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import prisma from "@/shared/lib/prisma";
import { getBaseUrl } from "@/shared/lib/url";
import { hashToken } from "@/shared/lib/token";
import { normalizeHandle } from "@/shared/lib/handle";
import { ForbiddenError, NotFoundError, RateLimitError } from "@/shared/errors";
import { verifyEventAdmin } from "@/features/auth/server/actions";
import { connectCodeFor } from "@/features/telegram/model/connect-code";

/**
 * Token minting for manager recovery and chat binding.
 *
 * This module is deliberately NOT a "use server" file: anything exported from one becomes a
 * public, unauthenticated endpoint whose action ID ships in the client bundle. Callers are
 * server actions and route handlers that decide who may trigger each operation.
 */

/** Login links DMed to a manager stay valid this long. */
const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000;
/** Telegram short recovery tokens (`/start rec_<token>`) stay valid this long. */
const SHORT_TOKEN_TTL_MS = 15 * 60 * 1000;
/** Minimum gap between manager link DMs for one event. */
export const MANAGER_LINK_COOLDOWN_MS = 60 * 1000;

// TODO(Task 12): replace with requireEventAdmin from features/auth/server/verify.ts.
async function requireEventAdmin(slug: string): Promise<void> {
    if (!(await verifyEventAdmin(slug))) throw new ForbiddenError();
}

/**
 * Rotates the event's admin token and returns a ready-to-use admin link.
 * Admin only: rotation locks out every other holder of the old link.
 */
export async function generateManagerMagicLink(slug: string): Promise<string> {
    await requireEventAdmin(slug);

    const rawToken = randomUUID();
    await prisma.event.update({
        where: { slug },
        data: { adminToken: hashToken(rawToken) },
    });
    return `${getBaseUrl()}/api/event/${slug}/auth?token=${rawToken}`;
}

/**
 * Creates a short (8 hex chars), 15-minute, single-use token the admin opens as
 * `t.me/<bot>?start=rec_<token>` to register their Telegram account as manager.
 * Only the hash is stored. Admin only: redeeming it can claim the Telegram manager slot.
 */
export async function generateShortRecoveryToken(slug: string): Promise<string> {
    await requireEventAdmin(slug);

    const rawToken = randomBytes(4).toString("hex");
    await prisma.event.update({
        where: { slug },
        data: {
            recoveryToken: hashToken(rawToken),
            recoveryTokenExpires: new Date(Date.now() + SHORT_TOKEN_TTL_MS),
        },
    });
    return rawToken;
}

/**
 * The exact Telegram command that binds a chat to this event. Callers must have
 * established admin rights first; the code is as sensitive as the ability to redirect
 * the event's notifications.
 */
export async function getConnectCommand(slug: string): Promise<string> {
    const event = await prisma.event.findUnique({ where: { slug }, select: { adminToken: true } });
    if (!event?.adminToken) throw new NotFoundError("Event not found");
    return `/connect ${slug} ${connectCodeFor(slug, event.adminToken)}`;
}

// Per-event cooldown for manager link DMs. In-memory: on serverless each warm instance
// keeps its own map, so the limit is per instance, not global. It still bounds the DM rate
// a single caller can drive, and the link only ever goes to the stored manager identity.
const lastManagerLinkAt = new Map<string, number>();

/** Throws RateLimitError when a link for this event went out less than 60 s ago. */
export function claimManagerLinkCooldown(slug: string): void {
    const now = Date.now();
    const last = lastManagerLinkAt.get(slug);
    if (last !== undefined && now - last < MANAGER_LINK_COOLDOWN_MS) {
        throw new RateLimitError("A link was just sent. Please wait a minute before requesting another.");
    }
    lastManagerLinkAt.set(slug, now);
    if (lastManagerLinkAt.size > 10_000) {
        for (const [key, at] of lastManagerLinkAt) {
            if (now - at >= MANAGER_LINK_COOLDOWN_MS) lastManagerLinkAt.delete(key);
        }
    }
}

export function resetManagerLinkCooldownForTests(): void {
    lastManagerLinkAt.clear();
}

export type ManagerIdentity = {
    managerChatId: string | null;
    managerTelegram: string | null;
    managerDiscordId: string | null;
    managerDiscordUsername: string | null;
};

/**
 * Creates a 15-minute LoginToken bound to the event's stored manager identity and
 * returns the `/auth/login` URL that redeems it. The admin token is never rotated.
 * Only the hash is stored.
 */
export async function createManagerLoginLink(manager: ManagerIdentity): Promise<string> {
    if (!manager.managerChatId && !manager.managerDiscordId) {
        throw new ForbiddenError("No linked manager to notify");
    }

    const rawToken = randomUUID();
    await prisma.loginToken.create({
        data: {
            token: hashToken(rawToken),
            chatId: manager.managerChatId,
            telegramUsername: manager.managerChatId ? normalizeHandle(manager.managerTelegram) || null : null,
            discordId: manager.managerDiscordId,
            discordUsername: manager.managerDiscordId ? manager.managerDiscordUsername : null,
            expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MS),
        },
    });
    return `${getBaseUrl()}/auth/login?token=${rawToken}`;
}

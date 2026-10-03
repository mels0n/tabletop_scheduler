import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import prisma from "@/shared/lib/prisma";
import { getBaseUrl } from "@/shared/lib/url";
import { hashToken } from "@/shared/lib/token";
import { normalizeHandle } from "@/shared/lib/handle";
import { ForbiddenError, NotFoundError, RateLimitError } from "@/shared/errors";
import { requireEventAdmin } from "@/features/auth/server/verify";
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
/** Minimum gap between login links for one manager identity. */
export const MANAGER_LINK_COOLDOWN_MS = 60 * 1000;

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
 * the event's notifications. Derived from the current chat binding, so it is the code
 * valid for the next bind and dies once that bind succeeds.
 */
export async function getConnectCommand(slug: string): Promise<string> {
    const event = await prisma.event.findUnique({
        where: { slug },
        select: { adminToken: true, telegramChatId: true },
    });
    if (!event?.adminToken) throw new NotFoundError("Event not found");
    return `/connect ${slug} ${connectCodeFor(slug, event.adminToken, event.telegramChatId ?? null)}`;
}

export type ManagerIdentity = {
    managerChatId: string | null;
    managerTelegram: string | null;
    managerDiscordId: string | null;
    managerDiscordUsername: string | null;
};

/**
 * Throws RateLimitError when a LoginToken for this manager identity (its Telegram chat id
 * or Discord id) was created in the last 60 s. The check reads the database, so the limit
 * holds across serverless instances, and it covers every link-minting path for that
 * identity (manager recovery, `/start login`, the Discord magic login).
 */
export async function assertManagerLinkCooldown(manager: ManagerIdentity): Promise<void> {
    const identities = [
        ...(manager.managerChatId ? [{ chatId: manager.managerChatId }] : []),
        ...(manager.managerDiscordId ? [{ discordId: manager.managerDiscordId }] : []),
    ];
    if (identities.length === 0) return;

    const recent = await prisma.loginToken.findFirst({
        where: { OR: identities, createdAt: { gt: new Date(Date.now() - MANAGER_LINK_COOLDOWN_MS) } },
        select: { token: true },
    });
    if (recent) {
        throw new RateLimitError("A link was just sent. Please wait a minute before requesting another.");
    }
}

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

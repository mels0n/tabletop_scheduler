import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import prisma from "@/shared/lib/prisma";
import { getBaseUrl } from "@/shared/lib/url";
import { hashToken } from "@/shared/lib/token";
import { normalizeHandle } from "@/shared/lib/handle";
import { ForbiddenError, NotFoundError, RateLimitError } from "@/shared/errors";
import { requireEventAdmin } from "@/features/auth/server/verify";
import { connectCodeFor, newConnectNonce } from "@/features/telegram/model/connect-code";

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
const RATE_LIMITED = "A link was just sent. Please wait a minute before requesting another.";

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
 * the event's notifications. Derived from the current chat binding and connect nonce, so
 * it is the code valid for the next bind and dies once that bind succeeds. An event with
 * no nonce yet gets one persisted first, so the code shown is always tied to a stored nonce.
 */
export async function getConnectCommand(slug: string): Promise<string> {
    const event = await prisma.event.findUnique({
        where: { slug },
        select: { id: true, adminToken: true, telegramChatId: true, telegramConnectNonce: true },
    });
    if (!event?.adminToken) throw new NotFoundError("Event not found");

    let nonce = event.telegramConnectNonce;
    let chatId = event.telegramChatId ?? null;
    if (!nonce) {
        const fresh = newConnectNonce();
        // Only set it if still null; a concurrent writer's nonce wins and is re-read below.
        await prisma.event.updateMany({
            where: { id: event.id, telegramConnectNonce: null },
            data: { telegramConnectNonce: fresh },
        });
        const current = await prisma.event.findUnique({
            where: { slug },
            select: { telegramChatId: true, telegramConnectNonce: true },
        });
        nonce = current?.telegramConnectNonce ?? fresh;
        chatId = current?.telegramChatId ?? null;
    }
    return `/connect ${slug} ${connectCodeFor(slug, event.adminToken, chatId, nonce)}`;
}

export type LoginPlatform = "telegram" | "discord";
export const ALL_PLATFORMS: readonly LoginPlatform[] = ["telegram", "discord"];

export type ManagerIdentity = {
    managerChatId: string | null;
    managerTelegram: string | null;
    managerDiscordId: string | null;
    managerDiscordUsername: string | null;
};

/**
 * Throws RateLimitError when a LoginToken for one of the targeted manager identities (the
 * Telegram chat id and/or Discord id named by `platforms`) was created in the last 60 s.
 * The check reads the database, so the limit holds across serverless instances, and it
 * sees tokens from every link-minting path for that identity (manager recovery and
 * `/start login`).
 */
export async function assertManagerLinkCooldown(
    manager: ManagerIdentity,
    platforms: readonly LoginPlatform[]
): Promise<void> {
    const identities = [
        ...(platforms.includes("telegram") && manager.managerChatId ? [{ chatId: manager.managerChatId }] : []),
        ...(platforms.includes("discord") && manager.managerDiscordId ? [{ discordId: manager.managerDiscordId }] : []),
    ];
    if (identities.length === 0) return;

    const recent = await prisma.loginToken.findFirst({
        where: { OR: identities, createdAt: { gt: new Date(Date.now() - MANAGER_LINK_COOLDOWN_MS) } },
        select: { token: true },
    });
    if (recent) {
        throw new RateLimitError(RATE_LIMITED);
    }
}

/** The LoginToken identity columns for one platform, or null when it is not linked. */
function identityFor(manager: ManagerIdentity, platform: LoginPlatform) {
    if (platform === "telegram") {
        return manager.managerChatId
            ? {
                chatId: manager.managerChatId,
                telegramUsername: normalizeHandle(manager.managerTelegram) || null,
                discordId: null,
                discordUsername: null,
            }
            : null;
    }
    return manager.managerDiscordId
        ? {
            chatId: null,
            telegramUsername: null,
            discordId: manager.managerDiscordId,
            discordUsername: manager.managerDiscordUsername,
        }
        : null;
}

/**
 * Creates 15-minute LoginTokens for each requested platform the manager linked, one token per
 * platform carrying ONLY that platform's identity, and returns the `/auth/login` URL for
 * each. Separate tokens mean the link DMed to one identity can never mint the other
 * identity's cookie: an event's two manager identities may belong to different people.
 * The admin token is never rotated. Only hashes are stored.
 *
 * Cooldown without a check-then-create race: each token is created first, then the tokens
 * for that identity inside the cooldown window are counted. More than one means another
 * request got there first, so every token this call created is deleted and RateLimitError
 * is thrown. Two concurrent requests can both refuse; neither can both succeed.
 */
export async function createManagerLoginLinks(
    manager: ManagerIdentity,
    requested: readonly LoginPlatform[]
): Promise<Partial<Record<LoginPlatform, string>>> {
    const platforms = ALL_PLATFORMS.filter((p) => requested.includes(p) && identityFor(manager, p));
    if (platforms.length === 0) throw new ForbiddenError("No linked manager to notify");

    const created: string[] = [];
    const links: Partial<Record<LoginPlatform, string>> = {};
    try {
        for (const platform of platforms) {
            const identity = identityFor(manager, platform)!;
            const rawToken = randomUUID();
            const tokenHash = hashToken(rawToken);
            await prisma.loginToken.create({
                data: { token: tokenHash, ...identity, expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MS) },
            });
            created.push(tokenHash);

            const inWindow = await prisma.loginToken.count({
                where: {
                    ...(platform === "telegram" ? { chatId: identity.chatId } : { discordId: identity.discordId }),
                    createdAt: { gt: new Date(Date.now() - MANAGER_LINK_COOLDOWN_MS) },
                },
            });
            if (inWindow > 1) throw new RateLimitError(RATE_LIMITED);

            links[platform] = `${getBaseUrl()}/auth/login?token=${rawToken}`;
        }
    } catch (e) {
        if (created.length > 0) {
            await prisma.loginToken.deleteMany({ where: { token: { in: created } } }).catch(() => undefined);
        }
        throw e;
    }
    return links;
}

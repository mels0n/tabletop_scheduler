"use server";

import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { getBaseUrl } from "@/shared/lib/url";
import { escapeHtml } from "@/shared/lib/escape";
import { normalizeHandle } from "@/shared/lib/handle";
import { z } from "zod";
import { AppError, ValidationError } from "@/shared/errors";
import { handleParam, slugParam } from "@/shared/lib/action-params";
import { requireEventAdmin } from "@/features/auth/server/verify";
import { sendDirectMessage, isDelivered, type DeliveryOutcome, type DeliveryResult } from "@/features/notifications";
import {
    assertManagerLinkCooldown,
    createManagerLoginLinks,
    generateShortRecoveryToken,
    getConnectCommand,
    ALL_PLATFORMS,
    type LoginPlatform,
} from "./recovery-tokens";

/**
 * Server actions for manager recovery. Every export here is a public endpoint, so none of
 * them hands a credential to the caller unless the caller is already the event admin:
 * recovery links only ever go to the manager identity stored on the event, by DM. The
 * one-click sender is admin only; the public path must name the stored handle.
 */

const log = Logger.get("RecoveryActions");

const NO_MANAGER = "No linked manager to notify";

type ActionFailure = { success?: undefined; error: string; code?: string };
type ManagerLinkResult = { success: true; message: string; error?: undefined; code?: undefined } | ActionFailure;

/** Serialises expected errors for the client; anything else is logged and made generic. */
function toActionError(e: unknown, fallback: string): ActionFailure {
    if (e instanceof AppError && e.status < 500) return { error: e.message, code: e.code };
    log.error(fallback, e as Error);
    return { error: fallback };
}

const platformParam = z.enum(["telegram", "discord"]);
const recoverArgs = z.object({ slug: slugParam, handle: handleParam, platform: platformParam.optional() });

const PLATFORM_NAME: Record<LoginPlatform, string> = { telegram: "Telegram", discord: "Discord" };

/** Throws `ValidationError` unless `slug` is a well-formed slug; `toActionError` maps it. */
function parseSlug(slug: unknown): string {
    const parsed = slugParam.safeParse(slug);
    if (!parsed.success) throw new ValidationError();
    return parsed.data;
}

const managerSelect = {
    slug: true,
    title: true,
    managerTelegram: true,
    managerChatId: true,
    managerDiscordId: true,
    managerDiscordUsername: true,
} as const;

type ManagerEvent = {
    slug: string;
    title: string;
    managerTelegram: string | null;
    managerChatId: string | null;
    managerDiscordId: string | null;
    managerDiscordUsername: string | null;
};

/**
 * DMs a 15-minute login link to each of `targets` the manager has linked, one token per
 * platform. The link logs the
 * browser in as the stored manager identity, which grants admin on the manage page. The
 * admin token is never rotated, so nobody can lock the manager out by calling this.
 */
async function deliverManagerLink(
    event: ManagerEvent,
    targets: readonly LoginPlatform[]
): Promise<ManagerLinkResult> {
    const wantsTelegram = targets.includes("telegram") && !!event.managerChatId;
    const wantsDiscord = targets.includes("discord") && !!event.managerDiscordId;
    if (!wantsTelegram && !wantsDiscord) return { error: NO_MANAGER };

    try {
        // Cheap early refusal; createManagerLoginLinks re-checks after creating, race free.
        await assertManagerLinkCooldown(event, targets);
        const links = await createManagerLoginLinks(event, targets);
        const manageUrl = `${getBaseUrl()}/e/${event.slug}/manage`;
        const notLinked: DeliveryOutcome = { status: "skipped", reason: "not_linked" };

        // One token per platform, each DMed only to its own platform, so whoever controls
        // one manager identity never receives a link that logs in as the other.
        const sendTo = async (platform: LoginPlatform): Promise<DeliveryOutcome> => {
            const linked = platform === "telegram" ? event.managerChatId : event.managerDiscordId;
            const loginUrl = links[platform];
            if (!targets.includes(platform) || !linked || !loginUrl) return notLinked;
            const res = await sendDirectMessage(
                platform === "telegram"
                    ? { telegramChatId: linked, discordUserId: null }
                    : { telegramChatId: null, discordUserId: linked },
                {
                    html:
                        `🔐 <b>Manager login</b>\n\n` +
                        `Someone (hopefully you) asked for a login link for <b>${escapeHtml(event.title)}</b>.\n\n` +
                        `${loginUrl}\n\n` +
                        `After logging in, manage the event here:\n${manageUrl}\n\n` +
                        `(Valid for 15 minutes. If you did not ask for this, you can ignore it.)`,
                },
                { slug: event.slug, purpose: "manager-recovery", platform },
                // The manager asked for this link, so a DM opt-out never blocks it.
                { respectOptOut: false }
            );
            return res[platform];
        };

        const telegram = await sendTo("telegram");
        const discord = await sendTo("discord");
        const result: DeliveryResult = { telegram, discord };

        if (!isDelivered(result)) {
            log.warn("Manager recovery DM was not delivered", {
                slug: event.slug, telegram: result.telegram.status, discord: result.discord.status,
            });
            return { error: "Could not deliver the link. Check that the bot can message you, then try again." };
        }

        const platforms = [
            result.telegram.status === "sent" ? "Telegram" : null,
            result.discord.status === "sent" ? "Discord" : null,
        ].filter(Boolean).join(" and ");
        log.info("Manager recovery DM sent", { slug: event.slug, platforms });
        return { success: true as const, message: `Login link sent to your ${platforms} DMs!` };
    } catch (e) {
        return toActionError(e, "Could not send the link. Please try again.");
    }
}

/**
 * Lost-link recovery from the public event page. The typed handle (Telegram handle or
 * Discord username) must match the stored manager; the link still only goes to the stored
 * manager's DMs. `platform` is the tab the user picked: only that platform's handle is
 * matched and only that platform is DMed. Omitted (a page loaded before this argument
 * existed), any platform whose handle matches is DMed.
 */
export async function recoverManagerLink(slug: string, handle: string, platform?: LoginPlatform): Promise<ManagerLinkResult> {
    if (!recoverArgs.safeParse({ slug, handle, platform }).success) {
        return toActionError(new ValidationError(), "Could not send the link. Please try again.");
    }
    const event = await prisma.event.findUnique({ where: { slug }, select: managerSelect });

    if (!event || (!event.managerTelegram && !event.managerDiscordId)) {
        return { error: "No manager linked to this event." };
    }

    const input = normalizeHandle(handle);
    const matches = (p: LoginPlatform) =>
        (!platform || platform === p) &&
        !!input &&
        normalizeHandle(p === "telegram" ? event.managerTelegram : event.managerDiscordUsername) === input;
    const matched = ALL_PLATFORMS.filter(matches);

    if (matched.length === 0) {
        log.warn("Manager recovery failed: Handle mismatch", { slug });
        return { error: "Handle does not match our records." };
    }

    if (!event.managerChatId && !event.managerDiscordId) {
        return { error: "Handle matched, but no Telegram or Discord account has been linked as this event's manager yet, so there is nowhere to send a link." };
    }

    // Never fall back to the other platform: its account may belong to someone else.
    const isLinked = (p: LoginPlatform) => !!(p === "telegram" ? event.managerChatId : event.managerDiscordId);
    const targets = matched.filter(isLinked);
    if (targets.length === 0) {
        const other: LoginPlatform = matched[0] === "telegram" ? "discord" : "telegram";
        return {
            error: `Handle matched, but that ${PLATFORM_NAME[matched[0]]} account is not registered for login links yet.` +
                (isLinked(other) ? ` Try the ${PLATFORM_NAME[other]} option instead.` : ""),
        };
    }
    return deliverManagerLink(event, targets);
}

/**
 * Admin only: one-click "send me a login link" from the manage page. No handle check is
 * needed: the caller already proved admin, and the link can only reach the manager
 * identity stored on the event. Anyone without admin uses `recoverManagerLink`, which
 * makes them name the stored handle first. `platform` is the button's own platform; the
 * link goes only there.
 */
export async function dmManagerLink(slug: string, platform: LoginPlatform): Promise<ManagerLinkResult> {
    try {
        parseSlug(slug);
        if (!platformParam.safeParse(platform).success) throw new ValidationError();
        await requireEventAdmin(slug);
    } catch (e) {
        return toActionError(e, "Could not send the link. Please try again.");
    }
    const event = await prisma.event.findUnique({ where: { slug }, select: managerSelect });
    if (!event) return { error: NO_MANAGER };
    return deliverManagerLink(event, [platform]);
}

/**
 * Admin only: mints the short token for `t.me/<bot>?start=rec_<token>`, which registers the
 * admin's Telegram account as the event's manager for future recovery DMs.
 */
export async function startTelegramRecovery(slug: string): Promise<{ success: true; token: string; error?: undefined } | ActionFailure> {
    try {
        parseSlug(slug);
        const token = await generateShortRecoveryToken(slug);
        return { success: true as const, token };
    } catch (e) {
        return toActionError(e, "Failed to generate token");
    }
}

/** Admin only: the `/connect <slug> <code>` command shown on the manage page. */
export async function connectCommandForAdmin(slug: string): Promise<{ success: true; command: string; error?: undefined } | ActionFailure> {
    try {
        parseSlug(slug);
        await requireEventAdmin(slug);
        return { success: true as const, command: await getConnectCommand(slug) };
    } catch (e) {
        return toActionError(e, "Could not load the connect command.");
    }
}

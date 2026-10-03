"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import prisma from "@/shared/lib/prisma";
import Logger from "@/shared/lib/logger";
import { readIdentityCookie } from "@/shared/lib/session";
import { setDmOptOut } from "@/entities/notification-preference";

const log = Logger.get("DmPreference");

type Platform = 'telegram' | 'discord';

const PLATFORM_LABEL: Record<Platform, string> = {
    telegram: 'Telegram',
    discord: 'Discord',
};

const dmPreferenceInput = z.object({
    platform: z.enum(['telegram', 'discord']),
    optOut: z.boolean(),
});

export type SetDmPreferenceResult =
    | { success: true; optOut: boolean }
    | { error: string; status: 400 | 403 | 500 };

/**
 * @function setDmPreference
 * @description Turns bot direct messages off (`optOut: true`) or back on for one platform
 * the caller has linked on this browser. The identity comes only from the signed identity
 * cookie, so a caller can change the preference of their own linked account and nobody
 * else's. Group and channel posts are not affected, and login links the user requests are
 * always sent.
 */
export async function setDmPreference(platform: Platform, optOut: boolean): Promise<SetDmPreferenceResult> {
    const input = dmPreferenceInput.safeParse({ platform, optOut });
    if (!input.success) return { error: "Invalid request.", status: 400 };

    const cookieStore = await cookies();
    const platformId = readIdentityCookie(cookieStore, input.data.platform);
    if (!platformId) {
        return { error: `Link ${PLATFORM_LABEL[input.data.platform]} on this browser first.`, status: 403 };
    }

    try {
        await setDmOptOut(prisma, input.data.platform, platformId, input.data.optOut);
        log.info("DM preference updated", { platform: input.data.platform, optOut: input.data.optOut });
        return { success: true, optOut: input.data.optOut };
    } catch (e) {
        log.error("Failed to update DM preference", e as Error);
        return { error: "System error. Please try again.", status: 500 };
    }
}

import "server-only";

import { cookies } from "next/headers";
import prisma from "@/shared/lib/prisma";
import { readIdentity } from "@/shared/lib/session";
import { isDmOptedOut } from "@/entities/notification-preference";

/** Per platform: true when bot direct messages are off, false when on, null when not linked on this browser. */
export interface DmPreferences {
    telegram: boolean | null;
    discord: boolean | null;
}

/**
 * Reads the caller's direct message preferences for the profile page. Server-side only
 * (not an action): it trusts nothing but the signed identity cookies.
 */
export async function getDmPreferences(): Promise<DmPreferences> {
    const identity = readIdentity(await cookies());
    const [telegram, discord] = await Promise.all([
        identity.chatId ? isDmOptedOut(prisma, "telegram", identity.chatId) : Promise.resolve(null),
        identity.discordId ? isDmOptedOut(prisma, "discord", identity.discordId) : Promise.resolve(null),
    ]);
    return { telegram, discord };
}

import type { PrismaClient } from "@prisma/client";

/** Platforms the bot can direct message. The id is the Telegram chat id or the Discord user id. */
export type DmPlatform = "telegram" | "discord";

/** The slice of a Prisma client (or transaction) these rules need. */
export type DmPreferenceStore = Pick<PrismaClient, "dmPreference">;

/**
 * True when the user behind this platform id has turned off bot direct messages.
 * No stored row means direct messages are on.
 */
export async function isDmOptedOut(prisma: DmPreferenceStore, platform: DmPlatform, platformId: string): Promise<boolean> {
    const row = await prisma.dmPreference.findUnique({
        where: { platform_platformId: { platform, platformId } },
        select: { dmOptOut: true },
    });
    return row?.dmOptOut === true;
}

/**
 * Records the user's choice. Opting out stores a row; opting back in deletes it, because no
 * row already means direct messages are on, and a user on the default keeps no record.
 */
export async function setDmOptOut(prisma: DmPreferenceStore, platform: DmPlatform, platformId: string, optOut: boolean): Promise<void> {
    if (!optOut) {
        await prisma.dmPreference.deleteMany({ where: { platform, platformId } });
        return;
    }
    await prisma.dmPreference.upsert({
        where: { platform_platformId: { platform, platformId } },
        create: { platform, platformId, dmOptOut: true },
        update: { dmOptOut: true },
    });
}

import { cache } from "react";
import type { Prisma } from "@prisma/client";
import prisma from "@/shared/lib/prisma";

/**
 * Transport shapes for the event and manage pages. Prisma rows never reach client
 * components: the pages load a narrow `select`, then map rows through these functions.
 *
 * Deliberately absent from every DTO: adminToken, recoveryToken, fromUrl, pinned message
 * IDs, and every platform ID (chatId, discordId, telegramId, managerChatId,
 * managerDiscordId, telegramChatId). The manage page gets display handles only.
 */

export type PublicEvent = {
    id: number;
    slug: string;
    title: string;
    description: string | null;
    status: string;
    eventType: string;
    timezone: string;
    minPlayers: number;
    maxPlayers: number | null;
    finalizedSlotId: number | null;
    /** `address` mirrors the event's location string (participants carry no address of their own). */
    finalizedHost: { id: number; name: string; address: string | null } | null;
    location: string | null;
    createdAt: Date;
};

export type PublicParticipant = {
    id: number;
    name: string;
    status: string;
    isHost: boolean;
    hasTelegram: boolean;
    hasDiscord: boolean;
};

/** Manage page only: handles are shown to the organizer, numeric IDs never are. */
export type ManageParticipant = PublicParticipant & {
    telegramHandle: string | null;
    discordUsername: string | null;
};

export type PublicVote = {
    participantId: number;
    /** YES | MAYBE | NO */
    value: string;
    canHost: boolean;
    /** Needed for first-come-first-served ordering on finalized events. */
    createdAt: Date;
};

export type PublicSlot = {
    id: number;
    startTime: Date;
    endTime: Date;
    votes: PublicVote[];
};

/**
 * Columns the event page loads. Participant platform IDs are selected because the page
 * compares them with the viewer's verified identity on the server; they are stripped by
 * `toPublicParticipant` before anything is handed to a client component.
 */
export const eventPageSelect = {
    id: true,
    slug: true,
    title: true,
    description: true,
    status: true,
    eventType: true,
    timezone: true,
    minPlayers: true,
    maxPlayers: true,
    finalizedSlotId: true,
    finalizedHostId: true,
    location: true,
    telegramLink: true,
    createdAt: true,
    finalizedHost: { select: { id: true, name: true } },
    participants: {
        select: {
            id: true,
            name: true,
            status: true,
            telegramId: true,
            chatId: true,
            discordId: true,
            discordUsername: true,
        },
    },
    timeSlots: {
        select: {
            id: true,
            startTime: true,
            endTime: true,
            votes: {
                select: { participantId: true, preference: true, canHost: true, createdAt: true },
            },
        },
        orderBy: { startTime: "asc" },
    },
    finalizedSessions: {
        select: {
            id: true,
            timeSlot: { select: { id: true, startTime: true, endTime: true } },
        },
        orderBy: { createdAt: "asc" },
    },
} satisfies Prisma.EventSelect;

export type EventPageRow = Prisma.EventGetPayload<{ select: typeof eventPageSelect }>;

type EventRowInput = Pick<
    EventPageRow,
    | "id" | "slug" | "title" | "description" | "status" | "eventType" | "timezone"
    | "minPlayers" | "maxPlayers" | "finalizedSlotId" | "location" | "createdAt" | "finalizedHost"
>;

type ParticipantRowInput = {
    id: number;
    name: string;
    status: string;
    telegramId?: string | null;
    chatId?: string | null;
    discordId?: string | null;
    discordUsername?: string | null;
};

type SlotRowInput = {
    id: number;
    startTime: Date;
    endTime: Date;
    votes: { participantId: number; preference: string; canHost: boolean; createdAt: Date }[];
};

export function toPublicEvent(row: EventRowInput): PublicEvent {
    return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        status: row.status,
        eventType: row.eventType,
        timezone: row.timezone,
        minPlayers: row.minPlayers,
        maxPlayers: row.maxPlayers,
        finalizedSlotId: row.finalizedSlotId,
        finalizedHost: row.finalizedHost
            ? { id: row.finalizedHost.id, name: row.finalizedHost.name, address: row.location }
            : null,
        location: row.location,
        createdAt: row.createdAt,
    };
}

export function toPublicParticipant(
    row: ParticipantRowInput,
    finalizedHostId: number | null = null,
): PublicParticipant {
    return {
        id: row.id,
        name: row.name,
        status: row.status,
        isHost: finalizedHostId !== null && row.id === finalizedHostId,
        hasTelegram: !!row.chatId,
        hasDiscord: !!row.discordId,
    };
}

export function toManageParticipant(
    row: ParticipantRowInput,
    finalizedHostId: number | null = null,
): ManageParticipant {
    return {
        ...toPublicParticipant(row, finalizedHostId),
        telegramHandle: row.telegramId ?? null,
        discordUsername: row.discordUsername ?? null,
    };
}

export function toPublicSlot(row: SlotRowInput): PublicSlot {
    return {
        id: row.id,
        startTime: row.startTime,
        endTime: row.endTime,
        votes: row.votes.map((v) => ({
            participantId: v.participantId,
            value: v.preference,
            canHost: v.canHost,
            createdAt: v.createdAt,
        })),
    };
}

/**
 * Loads the event page's data once per request: `generateMetadata` and the page body
 * both call this, and React's `cache` collapses them into a single query.
 */
export const getEventForPage = cache(async (slug: string) => {
    return prisma.event.findUnique({ where: { slug }, select: eventPageSelect });
});

import { z } from "zod";

/**
 * Request schemas for the event API routes. Every route parses its body with one of these
 * before touching the database; a `ZodError` maps to 400 in `shared/errors` `toResponse`.
 */

const SUPPORTED_TIMEZONES: ReadonlySet<string> = new Set(Intl.supportedValuesOf("timeZone"));

/**
 * True when `tz` is an IANA zone the runtime can format with. `Intl.supportedValuesOf` lists
 * canonical zones only (no `UTC`, and some ICU builds omit aliases such as `Asia/Kolkata` that
 * browsers still report), so a zone missing from that list is accepted only if
 * `Intl.DateTimeFormat` resolves it. Either way, an accepted zone never throws later.
 */
export function isValidTimezone(tz: string): boolean {
    if (SUPPORTED_TIMEZONES.has(tz)) return true;
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

const timezone = z.string().max(64).refine(isValidTimezone, "Unknown timezone");

/** ISO 8601 timestamp with an explicit offset (`Z` or `+hh:mm`), as `Date#toISOString` emits. */
const isoDateTime = z.iso.datetime({ offset: true });

const slotTimes = z
    .object({ startTime: isoDateTime, endTime: isoDateTime })
    .refine((s) => new Date(s.startTime) < new Date(s.endTime), {
        message: "startTime must be before endTime",
        path: ["endTime"],
    });

const httpsUrl = z
    .url({ protocol: /^https$/ })
    .max(2048);

const positiveInt = z.number().int().positive();

/** Telegram invite link, rendered as an href on the event page: https://t.me/ only. */
const telegramInviteLink = z.string().max(200).startsWith("https://t.me/");

/** Form fields arrive as strings; empty strings mean "not provided". */
const formInt = z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().int().positive().optional(),
);

const optionalText = (max: number) =>
    z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().max(max).nullable());

/**
 * Most time options one event may hold, across creation, creator-added slots and visitor
 * suggestions. Production has events with a couple of hundred slots, so this is generous.
 */
export const MAX_EVENT_SLOTS = 500;

/** Most votes one request may carry: room for every slot of an event at the cap, and then some. */
const MAX_VOTES_PER_REQUEST = 1000;

export const createEventSchema = z
    .object({
        title: z.string().trim().min(1).max(120),
        description: z.string().max(2000).nullish().transform((v) => v || null),
        slots: z.array(slotTimes).min(1).max(MAX_EVENT_SLOTS),
        minPlayers: z.number().int().min(1).max(100).nullish().transform((v) => v ?? 3),
        maxPlayers: z.number().int().min(1).max(1000).nullish().transform((v) => v ?? null),
        timezone: timezone.nullish().transform((v) => v || "UTC"),
        eventType: z.enum(["ONE_SHOT", "CAMPAIGN"]).nullish().transform((v) => v ?? "ONE_SHOT"),
        minSessions: z.number().int().min(1).max(100).nullish().transform((v) => v ?? null),
        telegramLink: z.preprocess((v) => (v === "" ? null : v), telegramInviteLink.nullish()).transform((v) => v || null),
        fromUrl: httpsUrl.nullish().transform((v) => v || null),
        fromUrlId: z.string().max(200).nullish().transform((v) => v || null),
    })
    .refine((e) => e.maxPlayers === null || e.maxPlayers >= e.minPlayers, {
        message: "maxPlayers must be at least minPlayers",
        path: ["maxPlayers"],
    })
    .refine((e) => e.eventType !== "CAMPAIGN" || e.minSessions !== null, {
        message: "CAMPAIGN events require minSessions",
        path: ["minSessions"],
    });
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const voteSchema = z.object({
    name: z.string().trim().min(1).max(60),
    telegramId: z.string().max(64).nullish(),
    participantId: positiveInt.nullish(),
    slug: z.string().max(64).optional(),
    linkIdentity: z.boolean().optional(),
    linkTelegram: z.boolean().optional(),
    linkDiscord: z.boolean().optional(),
    votes: z
        .array(z.object({
            slotId: positiveInt,
            preference: z.enum(["YES", "NO", "MAYBE"]),
            canHost: z.boolean().optional().default(false),
        }))
        .max(MAX_VOTES_PER_REQUEST)
        .refine((votes) => new Set(votes.map((v) => v.slotId)).size === votes.length, {
            message: "Each slot may be voted on once",
        }),
});
export type VoteInput = z.infer<typeof voteSchema>;

export const slotSchema = slotTimes;
export type SlotInput = z.infer<typeof slotSchema>;

export const slotSuggestionSchema = z
    .object({
        startTime: isoDateTime,
        endTime: isoDateTime,
        suggesterName: z.string().trim().min(1).max(50),
    })
    .refine((s) => new Date(s.startTime) < new Date(s.endTime), {
        message: "startTime must be before endTime",
        path: ["endTime"],
    });

export const locationSchema = z.object({
    location: z.string().max(200).nullable(),
});

export const validateSlugsSchema = z.object({
    slugs: z.array(z.string().min(1).max(64)).max(50),
});

/** One-shot finalize, sent as FormData by the manage page. */
export const oneShotFinalizeSchema = z.object({
    slotId: z.coerce.number().int().positive(),
    houseId: formInt.transform((v) => v ?? null),
    location: optionalText(200),
});

/** Campaign finalize, sent as JSON. `participantIds` is the explicit roster when the UI picked one. */
export const campaignFinalizeSchema = z.object({
    slotIds: z
        .array(positiveInt)
        .min(1)
        .max(MAX_EVENT_SLOTS)
        .refine((ids) => new Set(ids).size === ids.length, { message: "Duplicate slot IDs" }),
    houseId: formInt.transform((v) => v ?? null),
    location: optionalText(200),
    participantIds: z.array(positiveInt).max(1000).optional(),
});

/** Voting reminder settings from the manage page. `days` are weekdays (0 = Sunday .. 6). */
export const reminderSettingsSchema = z
    .object({
        enabled: z.boolean(),
        time: z.string().max(5),
        days: z
            .array(z.number().int().min(0).max(6))
            .max(7)
            .refine((days) => new Set(days).size === days.length, { message: "Duplicate days" }),
    })
    .refine((r) => !r.enabled || /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(r.time), {
        message: "Invalid time format",
        path: ["time"],
    });
export type ReminderSettingsInput = z.infer<typeof reminderSettingsSchema>;

/** Numeric route params (`[slotId]`, `[participantId]`, the vote route's event id). */
export const idParam = z.coerce.number().int().positive();

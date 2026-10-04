import { z } from "zod";

/**
 * Argument schemas for server actions. A `"use server"` export is a public endpoint that
 * accepts any serializable value, not just the types its signature declares, so every
 * exported action parses its arguments with these before using them.
 */

/** Public event slug. Matches the unguessable base62 slugs and the `setAdminCookie` rule. */
export const slugParam = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/** Identity platform a link or session belongs to. */
export const platformParam = z.enum(["telegram", "discord"]);

/** Longest user-typed handle we accept (Telegram and Discord names are 32 at most). */
export const HANDLE_MAX_LENGTH = 64;

/**
 * Bounded user-typed handle. Not trimmed and not required to be non-empty: callers
 * normalise with `normalizeHandle` and own their empty-input message.
 */
export const handleParam = z.string().max(HANDLE_MAX_LENGTH);

/** `Participant.id` is a 32-bit autoincrement integer. */
export const participantIdParam = z.number().int().positive().max(2_147_483_647);

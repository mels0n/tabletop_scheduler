import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/shared/lib/prisma";
import { randomBytes, randomUUID } from "crypto";
import Logger from "@/shared/lib/logger";
import { normalizeHandle } from "@/shared/lib/handle";
import { hashToken } from "@/shared/lib/token";
import { getBaseUrlOrNull } from "@/shared/lib/url";
import { readIdentity } from "@/shared/lib/session";
import { assertSafeWebhookUrl } from "@/shared/lib/webhook-sender";
import { ConflictError, toResponse } from "@/shared/errors";
import { createEventSchema, type CreateEventInput } from "@/features/event-management";
import { processWebhookRow } from "@/features/integrations/webhooks";

const log = Logger.get("API:EventCreate");

const SLUG_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SLUG_BYTES = 10; // 80 bits of entropy
const SLUG_LENGTH = 14; // ceil(80 / log2(62))

/**
 * Generates an unguessable public slug: 10 random bytes (80 bits) encoded base62 to 14
 * characters. Alphanumeric only, so it survives every slug parser (Telegram commands and
 * pasted links match `[a-zA-Z0-9]+`), unlike base64url's `-` and `_`.
 */
function generateSlug(): string {
    let n = BigInt(`0x${randomBytes(SLUG_BYTES).toString("hex")}`);
    let out = "";
    for (let i = 0; i < SLUG_LENGTH; i++) {
        out = SLUG_ALPHABET[Number(n % BigInt(62))] + out;
        n /= BigInt(62);
    }
    return out;
}

function isUniqueViolation(err: unknown): boolean {
    return typeof err === "object" && err !== null
        && (err as { name?: unknown }).name === "PrismaClientKnownRequestError"
        && (err as { code?: unknown }).code === "P2002";
}

interface ManagerIdentity {
    managerChatId: string | null;
    managerTelegram: string | null;
    managerDiscordId: string | null;
    managerDiscordUsername: string | null;
}

/**
 * Identity Pre-Sync: if the creator holds a verified (signed) global identity cookie, they
 * become the manager of the new event. Unsigned or tampered cookies are ignored.
 */
async function resolveManagerIdentity(): Promise<ManagerIdentity> {
    const cookieStore = await cookies();
    const { chatId: globalChatId, discordId: globalDiscordId } = readIdentity(cookieStore);
    const globalDiscordName = globalDiscordId ? cookieStore.get("tabletop_user_discord_name")?.value || null : null;

    // Auto-hydrate their Telegram Handle if we know their Chat ID from a past event.
    let inferredTelegramHandle: string | null = null;
    if (globalChatId) {
        try {
            const pastParticipant = await prisma.participant.findFirst({
                where: { chatId: globalChatId, telegramId: { not: null } },
                orderBy: { createdAt: 'desc' },
                select: { telegramId: true }
            });
            if (pastParticipant) {
                // Defensive: legacy participant rows may still carry a stray '@';
                // canonicalize before it becomes the manager handle.
                inferredTelegramHandle = normalizeHandle(pastParticipant.telegramId);
            }
        } catch {
            log.warn("Failed to infer telegram handle during event creation");
        }
    }

    return {
        managerChatId: globalChatId,
        managerTelegram: inferredTelegramHandle,
        managerDiscordId: globalDiscordId,
        managerDiscordUsername: globalDiscordName,
    };
}

async function createEvent(input: CreateEventInput, slug: string, hashedAdminToken: string, manager: ManagerIdentity) {
    return prisma.$transaction(async (tx) => {
        const newEvent = await tx.event.create({
            data: {
                slug,
                title: input.title,
                description: input.description,
                adminToken: hashedAdminToken, // Store Hash
                telegramLink: input.telegramLink,
                ...manager,
                timezone: input.timezone,
                minPlayers: input.minPlayers,
                maxPlayers: input.maxPlayers,
                status: "DRAFT",
                fromUrl: input.fromUrl,
                fromUrlId: input.fromUrlId,
                eventType: input.eventType,
                minSessions: input.minSessions,
                timeSlots: {
                    create: input.slots.map((slot) => ({
                        startTime: new Date(slot.startTime),
                        endTime: new Date(slot.endTime),
                    })),
                },
            },
        });

        // External callback: only ENQUEUE here. The first delivery attempt runs after the
        // response (see POST); the webhooks cron retries whatever that leaves.
        let webhookId: string | null = null;
        if (input.fromUrl) {
            const origin = getBaseUrlOrNull();
            const row = await tx.webhookEvent.create({
                data: {
                    eventId: newEvent.id,
                    url: input.fromUrl,
                    status: "PENDING",
                    nextAttempt: new Date(),
                    payload: JSON.stringify({
                        type: "CREATED",
                        eventId: newEvent.id,
                        fromUrlId: input.fromUrlId,
                        slug: newEvent.slug,
                        ...(origin ? { link: `${origin}/e/${slug}` } : {}),
                        title: newEvent.title,
                        timestamp: new Date().toISOString()
                    })
                }
            });
            webhookId = row.id;
        }

        return { event: newEvent, webhookId };
    });
}

/**
 * @function POST
 * @description Creates a new event with initial time slots.
 *
 * Flow:
 * 1. Validates the payload with `createEventSchema` (400 on any problem, including an
 *    unknown timezone or a slot that ends before it starts).
 * 2. When `fromUrl` is given, checks it is https and resolves only to public addresses (400 otherwise).
 * 3. Generates an unguessable `slug` (retried once on a collision).
 * 4. Creates the Event, its TimeSlots and any CREATED webhook row in one transaction.
 *    After the response (`after()`), the row gets its first delivery attempt; the webhooks
 *    cron retries it if that attempt fails.
 * 5. Returns the plaintext `adminToken` once so the frontend can set the management cookie.
 *
 * @param {Request} req - JSON Payload: { title, description, minPlayers, maxPlayers, eventType, minSessions, slots: [{startTime, endTime}], timezone, fromUrl, fromUrlId }
 * @returns {NextResponse} JSON with { slug, id, adminToken }.
 */
export async function POST(req: Request) {
    try {
        const input = createEventSchema.parse(await req.json());

        if (input.fromUrl) {
            await assertSafeWebhookUrl(input.fromUrl);
        }

        log.debug("Request received", { slots: input.slots.length, eventType: input.eventType });

        // Security: Generate token manually so we can hash it for storage.
        const rawAdminToken = randomUUID();
        const hashedAdminToken = hashToken(rawAdminToken);
        const manager = await resolveManagerIdentity();

        let created;
        try {
            created = await createEvent(input, generateSlug(), hashedAdminToken, manager);
        } catch (err) {
            if (!isUniqueViolation(err)) throw err;
            log.warn("Slug collision; retrying once");
            try {
                created = await createEvent(input, generateSlug(), hashedAdminToken, manager);
            } catch (retryErr) {
                if (isUniqueViolation(retryErr)) throw new ConflictError("Could not allocate an event link; please retry");
                throw retryErr;
            }
        }

        const { event, webhookId } = created;
        if (webhookId) {
            // The event is committed: a scheduling failure must not cost the caller its admin
            // token, and the cron delivers the row either way.
            try {
                after(() => processWebhookRow(webhookId).then(
                    (outcome) => log.info("Immediate webhook attempt", { id: webhookId, outcome }),
                    (e) => log.error("Immediate webhook attempt failed", e as Error),
                ));
            } catch (e) {
                log.warn("Could not schedule the immediate webhook attempt; the cron will deliver it", { id: webhookId, error: String(e) });
            }
        }

        log.info("Event created successfully", { slug: event.slug, id: event.id, hasWebhook: Boolean(input.fromUrl) });
        // Return Plaintext to user
        return NextResponse.json({ slug: event.slug, id: event.id, adminToken: rawAdminToken });
    } catch (error) {
        return toResponse(error, log.forRequest(req));
    }
}

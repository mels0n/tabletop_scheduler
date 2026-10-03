import { createHash, timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/shared/lib/prisma';
import Logger from '@/shared/lib/logger';
import { getServerConfig } from '@/shared/config/server';
import { ConfigError, UnauthorizedError, ValidationError, toResponse } from '@/shared/errors';
import { parseAmountToCents } from '@/lib/donations';

const log = Logger.get('API:KofiWebhook');

/**
 * Ko-fi Webhook Receiver
 *
 * Accepts POST requests from Ko-fi when a payment event occurs (donation, subscription, etc.).
 * Ko-fi sends `application/x-www-form-urlencoded` with a `data` field containing a JSON string.
 *
 * Security: the `verification_token` is compared (constant time) against
 * `KOFI_VERIFICATION_TOKEN` before anything about the request is logged. Unverified requests
 * leave no trace of their content.
 * Privacy: only the fields the donor wall displays are stored. The supporter's email,
 * shipping address, and the raw payload are never stored or logged.
 * Idempotency: `kofi_transaction_id` (falling back to `message_id`) is the unique key.
 * Failures: a database error returns 500 so Ko-fi retries the delivery.
 *
 * @see https://ko-fi.com/manage/webhooks (requires login)
 */

/** Only the token is needed to authenticate; the rest is validated after verification. */
const tokenSchema = z.object({ verification_token: z.string() });

// Verified payload shape ("Send Single Donation Test", 2026-03-22). Unused fields are stripped.
const payloadSchema = z.object({
  message_id: z.string().max(200),
  timestamp: z.string().max(64).nullish(),
  type: z.string().max(40).nullish(),
  is_public: z.boolean().nullish(),
  from_name: z.string().max(200).nullish(),
  message: z.string().max(2000).nullish(),
  amount: z.string().max(32).nullish(),
  currency: z.string().max(8).nullish(),
  kofi_transaction_id: z.string().max(200).nullish(),
});

function tokenMatches(given: string, expected: string): boolean {
  // Hash both sides so the compare is constant time regardless of length.
  const a = createHash('sha256').update(given, 'utf8').digest();
  const b = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(a, b);
}

function parseData(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new ValidationError('Invalid payload');
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError('Malformed JSON');
  }
}

export async function POST(request: Request) {
  try {
    const expectedToken = getServerConfig().kofiVerificationToken;
    if (!expectedToken) {
      throw new ConfigError('KOFI_VERIFICATION_TOKEN is not configured; rejecting Ko-fi webhook');
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new ValidationError('Invalid payload');
    }
    const data = parseData(formData.get('data'));

    const auth = tokenSchema.safeParse(data);
    if (!auth.success || !tokenMatches(auth.data.verification_token, expectedToken)) {
      throw new UnauthorizedError();
    }

    // Verified from here on.
    const payload = payloadSchema.parse(data);
    const cents = parseAmountToCents(payload.amount);
    log.info('Ko-fi webhook received', { message_id: payload.message_id, type: payload.type, amount: payload.amount });

    if (cents === null) {
      log.warn('Ko-fi amount is not a number; storing 0', { message_id: payload.message_id });
    }

    const isPublic = payload.is_public ?? true;
    if (!isPublic) {
      return NextResponse.json({ status: 'ok', skipped: true });
    }

    let donatedAt = payload.timestamp ? new Date(payload.timestamp) : new Date();
    if (isNaN(donatedAt.getTime())) donatedAt = new Date();

    const transactionId = payload.kofi_transaction_id || payload.message_id;

    await prisma.donation.upsert({
      where: { kofiTransactionId: transactionId },
      update: {}, // No-op if already exists (idempotent for retries)
      create: {
        kofiTransactionId: transactionId,
        fromName: payload.from_name || 'Anonymous',
        message: payload.message || null,
        amount: ((cents ?? 0) / 100).toFixed(2),
        currency: payload.currency || 'USD',
        isPublic,
        type: payload.type || 'Donation',
        donatedAt,
      },
    });

    log.info('Ko-fi donation stored', { message_id: payload.message_id });

    // Trigger ISR revalidation so the landing page reflects the new donation immediately.
    revalidatePath('/');

    // Ko-fi expects a 200; non-200 triggers retries.
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    return toResponse(error, log);
  }
}

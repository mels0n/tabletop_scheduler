import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import prisma from '@/shared/lib/prisma';

/**
 * Ko-fi Webhook Receiver
 *
 * Accepts POST requests from Ko-fi when a payment event occurs (donation, subscription, etc.).
 * Ko-fi sends `application/x-www-form-urlencoded` with a `data` field containing a JSON string.
 *
 * Security: Validates the `verification_token` in the payload against `KOFI_VERIFICATION_TOKEN`.
 * Idempotency: Uses `kofi_transaction_id` as a unique key to prevent duplicate records.
 *
 * @see https://ko-fi.com/manage/webhooks (requires login)
 */

// --- Verified Ko-fi webhook payload shape ---
// Confirmed via "Send Single Donation Test" on 2026-03-22.
// Content-Type: application/x-www-form-urlencoded, field: "data" (JSON string).
interface KofiWebhookPayload {
  verification_token: string;
  message_id: string;
  timestamp: string;                    // ISO 8601 (e.g., "2026-03-22T20:00:41Z")
  type: 'Donation' | 'Subscription' | 'Commission' | 'Shop Order';
  is_public: boolean;
  from_name: string;                    // Supporter display name
  message: string | null;               // Optional public message
  amount: string;                       // Dollar amount (e.g., "3.00")
  url: string;                          // Ko-fi transaction URL
  email: string;                        // Supporter email — NEVER stored or displayed
  currency: string;                     // "USD", "GBP", etc.
  is_subscription_payment: boolean;
  is_first_subscription_payment: boolean;
  kofi_transaction_id: string;          // Unique transaction ID for deduplication
  shop_items: unknown[] | null;         // Non-null for Shop Order type
  tier_name: string | null;             // Non-null for membership tier subscriptions
  shipping: unknown | null;             // Non-null for physical item orders
  discord_username: string | null;      // Supporter's Discord tag (e.g., "Jo#4105")
  discord_userid: string | null;        // Supporter's Discord user ID
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const rawData = formData.get('data');

    if (!rawData || typeof rawData !== 'string') {
      console.error('[Ko-fi Webhook] Missing or invalid "data" field in POST body');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    let payload: KofiWebhookPayload;
    try {
      payload = JSON.parse(rawData);
    } catch {
      console.error('[Ko-fi Webhook] Failed to parse JSON from "data" field:', rawData);
      return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
    }

    // --- Log the full payload for discovery/debugging ---
    // This is critical for the initial deployment: we need to see the exact
    // shape Ko-fi sends before we finalize the type definitions above.
    console.log('[Ko-fi Webhook] Received payload:', JSON.stringify(payload, null, 2));

    // --- Verify authenticity ---
    const expectedToken = process.env.KOFI_VERIFICATION_TOKEN;

    if (!expectedToken) {
      console.error('[Ko-fi Webhook] KOFI_VERIFICATION_TOKEN is not configured. Rejecting request.');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    if (payload.verification_token !== expectedToken) {
      console.warn('[Ko-fi Webhook] Verification token mismatch. Rejecting.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // --- Parse donation timestamp ---
    // Ko-fi's timestamp format may vary; fallback to current time if parsing fails.
    let donatedAt: Date;
    try {
      donatedAt = new Date(payload.timestamp);
      if (isNaN(donatedAt.getTime())) {
        donatedAt = new Date();
      }
    } catch {
      donatedAt = new Date();
    }

    // --- Persist to database (idempotent via unique kofiTransactionId) ---
    const transactionId = payload.kofi_transaction_id || payload.message_id || `unknown-${Date.now()}`;

    try {
      await prisma.donation.upsert({
        where: { kofiTransactionId: transactionId },
        update: {}, // No-op if already exists (idempotent for retries)
        create: {
          kofiTransactionId: transactionId,
          fromName: payload.from_name || 'Anonymous',
          message: payload.message || null,
          amount: payload.amount || '0.00',
          currency: payload.currency || 'USD',
          isPublic: payload.is_public ?? true,
          type: payload.type || 'Donation',
          rawPayload: rawData, // Store full payload for future field extraction
          donatedAt,
        },
      });

      console.log(
        `[Ko-fi Webhook] Stored donation from "${payload.from_name}" — $${payload.amount} ${payload.currency} (${payload.type}, public: ${payload.is_public})`
      );

      // Trigger ISR revalidation so the landing page reflects the new donation immediately.
      revalidatePath('/');
    } catch (dbError) {
      console.error('[Ko-fi Webhook] Database error:', dbError);
      // Still return 200 to prevent Ko-fi from retrying endlessly on DB issues
      // The rawPayload is logged above for manual recovery
      return NextResponse.json({ status: 'error', detail: 'DB write failed' }, { status: 200 });
    }

    // --- Return 200 to acknowledge receipt ---
    // Ko-fi expects a 200; non-200 triggers retries.
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('[Ko-fi Webhook] Unhandled error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

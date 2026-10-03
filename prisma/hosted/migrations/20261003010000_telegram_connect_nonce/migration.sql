-- Per-event connect nonce. It is part of the Telegram /connect code HMAC and rotates on
-- every successful /connect, so a posted code is single-use even when the chat is unchanged.
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "telegramConnectNonce" TEXT;

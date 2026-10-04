/**
 * Public API of the outbound webhooks slice: the queue processor used by the webhooks cron
 * and by the immediate attempt each enqueue point schedules with `after()`. Server only.
 */
export { processWebhookRow, attemptClaimedWebhook, claimableWhere, MAX_ATTEMPTS, type WebhookAttemptOutcome } from "./server/process";
export { deliverWebhook, WebhookRefusedError, type OutboxRow } from "./server/deliver";

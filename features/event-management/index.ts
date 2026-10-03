/**
 * Public API of the event-management slice: request schemas, page DTOs,
 * manager actions, recovery, waitlist promotion and dashboard sync.
 *
 * Client components import the `"use server"` action modules directly
 * (`./server/actions`, `./server/recovery`) and DTO types with `import type`:
 * this index also re-exports server code (Prisma, bot tokens) that must never
 * enter a client bundle. Recovery-token minting stays internal to the slice.
 */
export {
    isValidTimezone,
    createEventSchema,
    voteSchema,
    slotSchema,
    slotSuggestionSchema,
    locationSchema,
    validateSlugsSchema,
    oneShotFinalizeSchema,
    campaignFinalizeSchema,
    reminderSettingsSchema,
    idParam,
} from "./model/schemas";
export type { CreateEventInput, VoteInput, SlotInput, ReminderSettingsInput } from "./model/schemas";
export { LEGACY_GRACE_UNTIL, LEGACY_PARTICIPANT_CUTOFF, isLegacyUnlinkedParticipant } from "./model/legacy";
export { PARTICIPANT_NOT_OWNED, voteErrorMessage } from "./model/vote-errors";
export {
    eventPageSelect,
    getEventForPage,
    toPublicEvent,
    toPublicParticipant,
    toManageParticipant,
    toPublicSlot,
} from "./model/dto";
export type {
    PublicEvent,
    PublicParticipant,
    ManageParticipant,
    PublicVote,
    PublicSlot,
    EventPageRow,
} from "./model/dto";
export {
    checkManagerStatus,
    checkEventStatus,
    updateManagerHandle,
    updateTelegramInviteLink,
    deleteEvent,
    cancelEvent,
    updateReminderSettings,
    updateSessionReminderSettings,
} from "./server/actions";
export {
    recoverManagerLink,
    dmManagerLink,
    startTelegramRecovery,
    connectCommandForAdmin,
} from "./server/recovery";
export { pushSlotUpdates, syncDashboard, refreshDiscordDashboard, refreshTelegramDashboard } from "./server/dashboard-sync";
export { processWaitlistPromotion } from "./server/waitlist";

/**
 * Public API of the auth slice: admin verification, the admin cookie, identity
 * linking, and the recovery and linked-accounts UI.
 *
 * Client components import the `"use server"` action modules directly
 * (`./server/actions`, `./server/participant-link`, ...): this index also
 * re-exports `server-only` code, which must never enter a client bundle.
 */
export { isAdminToken, verifyEventAdmin, requireEventAdmin } from "./server/verify";
export { setAdminCookie } from "./server/actions";
export { disconnectPlatformFromBrowser } from "./server/browser-disconnect";
export { unlinkPlatformEverywhere } from "./server/identity-unlink";
export { linkParticipant, unlinkParticipant } from "./server/participant-link";
export { LinkedAccountsPanel } from "./ui/LinkedAccountsPanel";
export { ManagerRecovery } from "./ui/ManagerRecovery";

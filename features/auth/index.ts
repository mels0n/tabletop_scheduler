/**
 * Public API of the auth slice: admin verification, the admin cookie, identity
 * linking, and the recovery and linked-accounts UI.
 *
 * Client components import the `"use server"` action modules directly
 * (`./server/actions`, `./server/participant-link`, ...): this index also
 * re-exports `server-only` code, which must never enter a client bundle.
 */
export { isAdminToken, upgradeLegacyAdminToken, verifyEventAdmin, requireEventAdmin } from "./server/verify";
export { setAdminCookie } from "./server/actions";
export { disconnectPlatformFromBrowser } from "./server/browser-disconnect";
export { unlinkPlatformEverywhere } from "./server/identity-unlink";
export { linkParticipant, unlinkParticipant } from "./server/participant-link";
export { setDmPreference } from "./server/dm-preference";
export { getDmPreferences } from "./server/dm-preference-read";
export type { DmPreferences } from "./server/dm-preference-read";
export { LinkedAccountsPanel } from "./ui/LinkedAccountsPanel";
export { DmPreferencePanel } from "./ui/DmPreferencePanel";
export { ManagerRecovery } from "./ui/ManagerRecovery";

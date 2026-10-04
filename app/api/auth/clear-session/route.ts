import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { IDENTITY_COOKIES } from "@/shared/lib/session";

/** Display-name cookies that accompany the identity cookies. */
const NAME_COOKIES = ["tabletop_user_telegram_name", "tabletop_user_discord_name"];

/**
 * @route POST /api/auth/clear-session
 * @description Clears the Tabletop identity cookies in one shot.
 *
 * Called by the global error boundary when a stale session cookie causes
 * an application crash. Deleting these cookies forces a clean re-auth
 * on next page load rather than looping on the error screen.
 *
 * Cookies cleared:
 * - tabletop_user_chat_id       (Telegram identity)
 * - tabletop_user_telegram_name (Telegram display name)
 * - tabletop_user_discord_id    (Discord identity)
 * - tabletop_user_discord_name  (Discord display name)
 *
 * Event admin cookies (tabletop_admin_<slug>) are deliberately kept: for a
 * manager who never linked an account they are the only copy of the admin
 * access on this browser, and they never cause the crash this route recovers.
 */
export async function POST() {
    const cookieStore = await cookies();

    for (const name of [IDENTITY_COOKIES.telegram, IDENTITY_COOKIES.discord, ...NAME_COOKIES]) {
        cookieStore.delete(name);
    }

    return NextResponse.json({ cleared: true });
}

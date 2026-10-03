import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { IDENTITY_COOKIES } from "@/shared/lib/session";

/** Display-name cookies that accompany the identity cookies. */
const NAME_COOKIES = ["tabletop_user_telegram_name", "tabletop_user_discord_name"];

const ADMIN_COOKIE_PREFIX = "tabletop_admin_";

/**
 * @route POST /api/auth/clear-session
 * @description Clears all Tabletop auth cookies in one shot.
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
 * - every tabletop_admin_<slug> present on the request (event admin tokens)
 */
export async function POST() {
    const cookieStore = await cookies();

    const names = new Set<string>([IDENTITY_COOKIES.telegram, IDENTITY_COOKIES.discord, ...NAME_COOKIES]);
    for (const cookie of cookieStore.getAll()) {
        if (cookie.name.startsWith(ADMIN_COOKIE_PREFIX)) names.add(cookie.name);
    }

    for (const name of names) {
        cookieStore.delete(name);
    }

    return NextResponse.json({ cleared: true });
}

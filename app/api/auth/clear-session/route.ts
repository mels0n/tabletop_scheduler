import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * @route POST /api/auth/clear-session
 * @description Clears all Tabletop auth cookies in one shot.
 *
 * Called by the global error boundary when a stale session cookie causes
 * an application crash. Deleting these cookies forces a clean re-auth
 * on next page load rather than looping on the error screen.
 *
 * Cookies cleared:
 * - tabletop_user_chat_id      — Telegram identity
 * - tabletop_user_discord_id   — Discord identity
 * - tabletop_user_discord_name — Discord display name (non-sensitive, public)
 */
export async function POST() {
    const cookieStore = cookies();

    const AUTH_COOKIES = [
        "tabletop_user_chat_id",
        "tabletop_user_discord_id",
        "tabletop_user_discord_name",
    ];

    AUTH_COOKIES.forEach((name) => {
        cookieStore.delete(name);
    });

    return NextResponse.json({ cleared: true });
}

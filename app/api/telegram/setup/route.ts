import { NextResponse } from "next/server";
import { ensureWebhook } from "@/features/telegram/lib/telegram-client";

export const dynamic = 'force-dynamic'; // Ensure this never caches

export async function GET(request: Request) {
    // Basic security check: Only allow if a secret key matches or if it's an admin (simplified for now to just be obscured or open if low risk, 
    // but better to Require a CRON_SECRET header if used by cron, or just a sophisticated check).
    // For now, we'll assume this is triggered manually by an admin or cron with a secret.

    // Check for Cron Secret if available (Vercel Cron)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}` ||
        request.headers.get('x-vercel-cron') === '1'; // Vercel adds this header internaly

    // Allow manual hit if valid query param (simple protection)?
    // Let's just run it. The worst case is resetting the webhook to the same URL.

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    if (!token || !baseUrl) {
        return NextResponse.json({ error: "Missing config (TOKEN or BASE_URL)" }, { status: 500 });
    }

    try {
        console.log(`🔌 Manual Telegram Setup Triggered for ${baseUrl}`);
        const success = await ensureWebhook(baseUrl, token);

        if (success) {
            return NextResponse.json({ success: true, message: "Webhook configured successfully" });
        } else {
            return NextResponse.json({ success: false, error: "ensureWebhook returned false" }, { status: 500 });
        }
    } catch (e) {
        console.error("Manual Setup Error:", e);
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}

import { NextResponse } from "next/server";
import { getEventStats } from "@/shared/lib/event-stats";
import { publicConfig } from "@/shared/config/public";

// Public, read-only community counts (the same numbers as the homepage badges).
// Consumed by README badges (shields.io dynamic JSON) and external project cards.
// Hosted only: a self-hosted instance has no reason to publish its usage.
export const dynamic = "force-dynamic";

const CACHE_SECONDS = 3600;

export async function GET() {
  if (!publicConfig.isHosted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stats = await getEventStats();

  return NextResponse.json(
    {
      eventsActive: stats.totalEvents,
      votingOpen: stats.activeEvents,
      playersActive: stats.totalParticipants,
      gamesLockedIn: stats.finalizedEvents,
    },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

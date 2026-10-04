import { NextResponse } from "next/server";
import { fetchEventStats } from "@/shared/lib/event-stats";
import { publicConfig } from "@/shared/config/public";
import { NotFoundError, toResponse } from "@/shared/errors";
import Logger from "@/shared/lib/logger";

// Public, read-only community counts: the same counts the homepage stat badges show (the homepage
// refreshes every 12 hours, this endpoint hourly). Consumed by the README badges (shields.io dynamic
// JSON) and external project cards. The response key names are read by those badges' JSONPaths, so
// renaming one breaks a badge.
// Hosted only: a self-hosted instance has no reason to publish its usage.
// force-dynamic keeps Next from prerendering the route at build time (no database then); the CDN
// cache below is the only cache, and a failure response is never cacheable.
export const dynamic = "force-dynamic";

const CACHE_SECONDS = 3600;
const log = Logger.get("StatsRoute");

export async function GET() {
  if (!publicConfig.isHosted) {
    return toResponse(new NotFoundError(), log);
  }

  try {
    const stats = await fetchEventStats();

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
  } catch (error) {
    // A database failure must never be cached as "0 events": answer with an uncacheable error so the
    // badges show an error state instead of a false zero.
    const res = toResponse(error, log);
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("Access-Control-Allow-Origin", "*");
    return res;
  }
}

import prisma from '@/shared/lib/prisma';

export interface EventStats {
  totalEvents: number;
  activeEvents: number;
  totalParticipants: number;
  finalizedEvents: number;
}

/**
 * Fetches live event statistics for social proof display.
 * Only runs on hosted version to avoid DB queries in self-hosted mode.
 *
 * Uses efficient COUNT queries on indexed fields for minimal DB load.
 * Parallel execution with Promise.all to reduce query time.
 * 
 * Note: Old events are automatically deleted for privacy. These numbers
 * represent current system load, not historical all-time totals.
 *
 * @returns Stats object with counts, or zeroes on failure.
 */
export async function getEventStats(): Promise<EventStats> {
  try {
    // Parallel COUNT queries on indexed fields (eventId, status)
    // These are very fast even on SQLite with moderate data volumes
    // finalizedEvents: one-shots count as 1 each; campaigns count each locked FinalizedSession as 1
    const [totalEvents, activeEvents, totalParticipants, oneShotFinalized, campaignSessions] = await Promise.all([
      prisma.event.count(), // Fast: no WHERE clause
      prisma.event.count({ where: { status: 'DRAFT' } }), // Fast: indexed status field
      prisma.participant.count(), // Fast: no WHERE clause
      prisma.event.count({ where: { status: 'FINALIZED', eventType: 'ONE_SHOT' } }), // Fast: indexed status + eventType
      prisma.finalizedSession.count(), // Fast: no WHERE clause
    ]);
    const finalizedEvents = oneShotFinalized + campaignSessions;

    return {
      totalEvents,
      activeEvents,
      totalParticipants,
      finalizedEvents,
    };
  } catch (error) {
    console.error('[EventStats] Failed to fetch stats:', error);
    return {
      totalEvents: 0,
      activeEvents: 0,
      totalParticipants: 0,
      finalizedEvents: 0,
    };
  }
}
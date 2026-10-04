import { describe, it, expect, vi, beforeEach } from 'vitest';

const config = vi.hoisted(() => ({ isHosted: true }));

vi.mock('@/shared/config/public', () => ({ publicConfig: config }));
vi.mock('@/shared/lib/event-stats', () => ({
    getEventStats: vi.fn().mockResolvedValue({
        totalEvents: 207,
        activeEvents: 152,
        totalParticipants: 787,
        finalizedEvents: 153,
    }),
}));

import { GET } from './route';

describe('GET /api/stats', () => {
    beforeEach(() => {
        config.isHosted = true;
    });

    it('returns the public community counts with CDN caching and open CORS', async () => {
        const res = await GET();

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            eventsActive: 207,
            votingOpen: 152,
            playersActive: 787,
            gamesLockedIn: 153,
        });
        expect(res.headers.get('Cache-Control')).toContain('s-maxage=3600');
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('is not exposed on a self-hosted instance', async () => {
        config.isHosted = false;

        const res = await GET();

        expect(res.status).toBe(404);
    });
});

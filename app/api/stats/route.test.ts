import { describe, it, expect, vi, beforeEach } from 'vitest';

const config = vi.hoisted(() => ({ isHosted: true }));
const fetchEventStats = vi.hoisted(() => vi.fn());

vi.mock('@/shared/config/public', () => ({ publicConfig: config }));
vi.mock('@/shared/lib/event-stats', () => ({ fetchEventStats }));

import { GET } from './route';

const counts = {
    totalEvents: 207,
    activeEvents: 152,
    totalParticipants: 787,
    finalizedEvents: 153,
};

describe('GET /api/stats', () => {
    beforeEach(() => {
        config.isHosted = true;
        fetchEventStats.mockReset();
        fetchEventStats.mockResolvedValue(counts);
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
        expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=3600, stale-while-revalidate=3600');
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('answers a database failure with an uncacheable error instead of cached zeros', async () => {
        fetchEventStats.mockRejectedValue(new Error('db down'));

        const res = await GET();

        expect(res.status).toBe(500);
        expect(res.headers.get('Cache-Control')).toBe('no-store');
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
        const body = await res.json();
        expect(body).not.toHaveProperty('eventsActive');
        expect(body.error).toBeTruthy();
    });

    it('is not exposed on a self-hosted instance and never touches the database there', async () => {
        config.isHosted = false;

        const res = await GET();

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'Not found', code: 'not_found' });
        expect(res.headers.get('Cache-Control')).toBeNull();
        expect(fetchEventStats).not.toHaveBeenCalled();
    });
});

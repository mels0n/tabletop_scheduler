import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
    usePathname: () => '/e/evt',
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

import { VotingInterface } from './VotingInterface';

const slot = {
    id: 3,
    startTime: new Date('2026-11-01T18:00:00Z'),
    endTime: new Date('2026-11-01T22:00:00Z'),
    votes: [],
    counts: { yes: 0, maybe: 0, no: 0 },
};

function jsonResponse(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('VotingInterface: vote refused for a participant this browser does not own', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem('tabletop_participant_1', '5');
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
        vi.stubGlobal('alert', vi.fn());
        Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload: vi.fn() } });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('keeps the message, then votes as a new participant without the stored id', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(403, { error: 'Forbidden', code: 'participant_not_owned' }))
            .mockResolvedValueOnce(jsonResponse(200, { participantId: 9 }));

        render(<VotingInterface eventId={1} slug="evt" minPlayers={1} initialSlots={[slot]} participants={[]} />);

        fireEvent.click(screen.getByRole('button', { name: /Detailed/i }));
        fireEvent.change(screen.getByPlaceholderText('Your Name (Required)'), { target: { value: 'Dee' } });
        fireEvent.click(screen.getByRole('button', { name: 'Vote Available' }));
        fireEvent.click(screen.getByRole('button', { name: 'Submit Votes' }));

        expect(await screen.findByText(/sign in with that account to edit this vote/)).toBeTruthy();
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).participantId).toBe(5);
        // The event link's slug rides along so the API can let a legacy row be claimed.
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).slug).toBe('evt');

        fireEvent.click(screen.getByRole('button', { name: 'Vote as a new participant' }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
        const resubmitted = JSON.parse(fetchMock.mock.calls[1][1].body);
        expect(resubmitted.participantId).toBeNull();
        expect(resubmitted.votes).toEqual([{ slotId: 3, preference: 'YES', canHost: false }]);
        await waitFor(() => expect(localStorage.getItem('tabletop_participant_1')).toBe('9'));
    });
});

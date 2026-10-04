import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FinalizedEventView } from './FinalizedEventView';
import type { PublicEvent, PublicParticipant, PublicSlot } from '@/features/event-management/model/dto';

const event: PublicEvent = {
    id: 1,
    slug: 'evt',
    title: 'Game Night',
    description: null,
    status: 'FINALIZED',
    eventType: 'ONE_SHOT',
    timezone: 'UTC',
    minPlayers: 1,
    maxPlayers: 1,
    finalizedSlotId: 3,
    finalizedHost: null,
    location: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
};

const participant = (id: number, status: string): PublicParticipant => ({
    id, name: `P${id}`, status, isHost: false, hasTelegram: false, hasDiscord: false,
});

function slotWith(votes: PublicSlot['votes']): PublicSlot {
    return {
        id: 3,
        startTime: new Date('2026-11-01T18:00:00Z'),
        endTime: new Date('2026-11-01T22:00:00Z'),
        votes,
    };
}

function jsonResponse(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const NOT_OWNED_MESSAGE = /sign in with that account to edit this vote/;

describe('FinalizedEventView: failed vote responses', () => {
    const fetchMock = vi.fn();
    const alertMock = vi.fn();
    const reload = vi.fn();

    beforeEach(() => {
        localStorage.clear();
        fetchMock.mockReset();
        alertMock.mockReset();
        reload.mockReset();
        vi.stubGlobal('fetch', fetchMock);
        vi.stubGlobal('alert', alertMock);
        vi.stubGlobal('confirm', vi.fn(() => true));
        Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload } });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('shows the specific message when joining is refused with participant_not_owned', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(403, { error: 'Forbidden', code: 'participant_not_owned' }));

        render(<FinalizedEventView event={{ ...event, maxPlayers: 4 }} finalizedSlot={slotWith([])} participants={[]} />);

        fireEvent.change(screen.getByPlaceholderText('Your Name (Required)'), { target: { value: 'Dee' } });
        fireEvent.click(screen.getByRole('button', { name: "I'm Coming!" }));

        await waitFor(() => expect(alertMock).toHaveBeenCalledWith(expect.stringMatching(NOT_OWNED_MESSAGE)));
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).slug).toBe('evt');
        expect(reload).not.toHaveBeenCalled();
    });

    it('alerts and does not reload when giving up a spot fails', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(403, { error: 'Forbidden', code: 'participant_not_owned' }));
        const votes = [
            { participantId: 5, value: 'YES', canHost: false, createdAt: new Date('2026-10-02T00:00:00Z') },
            { participantId: 6, value: 'YES', canHost: false, createdAt: new Date('2026-10-03T00:00:00Z') },
        ];

        render(
            <FinalizedEventView
                event={event}
                finalizedSlot={slotWith(votes)}
                participants={[participant(5, 'ACCEPTED'), participant(6, 'WAITLIST')]}
                serverParticipantId={5}
            />
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Give up spot' }));

        await waitFor(() => expect(alertMock).toHaveBeenCalledWith(expect.stringMatching(NOT_OWNED_MESSAGE)));
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ participantId: 5, slug: 'evt' });
        expect(reload).not.toHaveBeenCalled();
    });

    it('falls back to the generic message for a non-JSON failure', async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => { throw new Error('not json'); } } as unknown as Response);

        render(<FinalizedEventView event={{ ...event, maxPlayers: 4 }} finalizedSlot={slotWith([])} participants={[]} />);

        fireEvent.change(screen.getByPlaceholderText('Your Name (Required)'), { target: { value: 'Dee' } });
        fireEvent.click(screen.getByRole('button', { name: "I'm Coming!" }));

        await waitFor(() => expect(alertMock).toHaveBeenCalledWith('Failed to save votes'));
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DmPreferencePanel } from './DmPreferencePanel';
import { setDmPreference } from '@/features/auth/server/dm-preference';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('@/features/auth/server/dm-preference', () => ({
    setDmPreference: vi.fn(),
}));
vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh }),
}));

const mockSet = setDmPreference as unknown as ReturnType<typeof vi.fn>;

describe('DmPreferencePanel', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('renders nothing when no platform is linked', () => {
        const { container } = render(<DmPreferencePanel preferences={{ telegram: null, discord: null }} />);
        expect(container.innerHTML).toBe('');
    });

    it('shows one toggle per linked platform with its current state and the scope copy', () => {
        render(<DmPreferencePanel preferences={{ telegram: false, discord: true }} />);

        const telegram = screen.getByRole('switch', { name: /telegram/i });
        const discord = screen.getByRole('switch', { name: /discord/i });
        expect(telegram.getAttribute('aria-checked')).toBe('true');
        expect(telegram.textContent).toMatch(/on/i);
        expect(discord.getAttribute('aria-checked')).toBe('false');
        expect(discord.textContent).toMatch(/off/i);
        expect(screen.getAllByText(/direct messages from the bot/i).length).toBeGreaterThan(0);
        expect(screen.getByText(/login links you request are always sent/i)).toBeTruthy();
    });

    it('hides the toggle of a platform that is not linked', () => {
        render(<DmPreferencePanel preferences={{ telegram: null, discord: false }} />);
        expect(screen.queryByRole('switch', { name: /telegram/i })).toBeNull();
        expect(screen.getByRole('switch', { name: /discord/i })).toBeTruthy();
    });

    it('turning DMs off calls the action with optOut true, then refreshes', async () => {
        mockSet.mockResolvedValue({ success: true, optOut: true });
        render(<DmPreferencePanel preferences={{ telegram: false, discord: null }} />);

        fireEvent.click(screen.getByRole('switch', { name: /telegram/i }));

        await waitFor(() => expect(mockSet).toHaveBeenCalledWith('telegram', true));
        await waitFor(() => expect(refresh).toHaveBeenCalled());
        expect(screen.getByRole('switch', { name: /telegram/i }).getAttribute('aria-checked')).toBe('false');
    });

    it('turning DMs back on calls the action with optOut false', async () => {
        mockSet.mockResolvedValue({ success: true, optOut: false });
        render(<DmPreferencePanel preferences={{ telegram: null, discord: true }} />);

        fireEvent.click(screen.getByRole('switch', { name: /discord/i }));

        await waitFor(() => expect(mockSet).toHaveBeenCalledWith('discord', false));
    });

    it('shows the error and keeps the old state when the action refuses', async () => {
        mockSet.mockResolvedValue({ error: 'Link Discord on this browser first.', status: 403 });
        render(<DmPreferencePanel preferences={{ telegram: null, discord: false }} />);

        fireEvent.click(screen.getByRole('switch', { name: /discord/i }));

        expect(await screen.findByText('Link Discord on this browser first.')).toBeTruthy();
        expect(screen.getByRole('switch', { name: /discord/i }).getAttribute('aria-checked')).toBe('true');
        expect(refresh).not.toHaveBeenCalled();
    });
});

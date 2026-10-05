import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/features/auth/server/participant-link', () => ({
    linkParticipant: vi.fn(),
    unlinkParticipant: vi.fn(),
}));
vi.mock('@/features/auth/server/browser-disconnect', () => ({
    disconnectPlatformFromBrowser: vi.fn(),
}));

import { ProfileDashboard } from './ProfileDashboard';

describe('ProfileDashboard: Connect Discord pill', () => {
    it('is hidden when Discord login is not configured', () => {
        render(<ProfileDashboard discordLoginEnabled={false} />);
        expect(screen.queryByRole('link', { name: /Connect Discord/i })).toBeNull();
    });

    it('is hidden when the prop is omitted', () => {
        render(<ProfileDashboard />);
        expect(screen.queryByRole('link', { name: /Connect Discord/i })).toBeNull();
    });

    it('links to the Discord login flow when Discord login is configured', () => {
        render(<ProfileDashboard discordLoginEnabled />);
        const pill = screen.getByRole('link', { name: /Connect Discord/i });
        expect(pill.getAttribute('href')).toBe('/api/auth/discord?flow=login&returnTo=/profile');
    });
});

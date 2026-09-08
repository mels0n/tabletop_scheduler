import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LinkedAccountsPanel } from './LinkedAccountsPanel';
import { unlinkPlatformEverywhere } from '@/features/auth/server/identity-unlink';

vi.mock('@/features/auth/server/identity-unlink', () => ({
    unlinkPlatformEverywhere: vi.fn(),
}));
vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn() }),
}));

const mockUnlink = unlinkPlatformEverywhere as unknown as ReturnType<typeof vi.fn>;

describe('LinkedAccountsPanel', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('renders nothing when no platform is synced', () => {
        const { container } = render(<LinkedAccountsPanel isTelegramSynced={false} isDiscordSynced={false} />);
        expect(container.firstChild).toBeNull();
    });

    it('shows a recovery-loss warning before unlinking Discord and only calls the action on confirm', async () => {
        mockUnlink.mockResolvedValue({ success: true, message: 'Discord unlinked.' });
        render(<LinkedAccountsPanel isTelegramSynced={false} isDiscordSynced={true} />);

        fireEvent.click(screen.getByRole('button', { name: /unlink discord/i }));

        // Warning shown, action not yet called.
        expect(screen.getByText(/magic.link recovery/i)).toBeTruthy();
        expect(mockUnlink).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: /yes, unlink/i }));

        await waitFor(() => expect(mockUnlink).toHaveBeenCalledWith('discord'));
        expect(await screen.findByText('Discord unlinked.')).toBeTruthy();
    });

    it('warns about Telegram event management before unlinking Telegram', () => {
        render(<LinkedAccountsPanel isTelegramSynced={true} isDiscordSynced={false} />);

        fireEvent.click(screen.getByRole('button', { name: /unlink telegram/i }));

        expect(screen.getByText(/lose telegram magic-link recovery/i)).toBeTruthy();
        expect(mockUnlink).not.toHaveBeenCalled();
    });

    it('cancel dismisses the warning without calling the action', () => {
        render(<LinkedAccountsPanel isTelegramSynced={false} isDiscordSynced={true} />);

        fireEvent.click(screen.getByRole('button', { name: /unlink discord/i }));
        fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

        expect(screen.queryByText(/magic.link recovery/i)).toBeNull();
        expect(mockUnlink).not.toHaveBeenCalled();
    });
});

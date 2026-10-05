import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/features/event-management/server/actions', () => ({
    updateTelegramInviteLink: vi.fn(),
    checkEventStatus: vi.fn(),
    checkManagerStatus: vi.fn(),
}));

vi.mock('@/features/event-management/server/recovery', () => ({
    connectCommandForAdmin: vi.fn(async () => ({ success: true, command: '/connect evt 123' })),
    startTelegramRecovery: vi.fn(),
    dmManagerLink: vi.fn(),
}));

import { checkEventStatus, checkManagerStatus } from '@/features/event-management/server/actions';
import { TelegramConnect } from './TelegramConnect';

function setVisibility(state: 'hidden' | 'visible') {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

async function startPolling() {
    render(
        <TelegramConnect
            slug="evt"
            botUsername="bot"
            hasChatId={false}
            initialHandle={null}
            hasManagerChatId={true}
        />,
    );
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Yes, it is' }));
    });
}

describe('TelegramConnect polling', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.mocked(checkEventStatus).mockReset();
        vi.mocked(checkManagerStatus).mockReset();
        vi.mocked(checkEventStatus).mockResolvedValue({ hasTelegramChatId: false } as never);
        setVisibility('visible');
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        setVisibility('visible');
    });

    it('does not poll while the tab is hidden', async () => {
        await startPolling();
        setVisibility('hidden');
        await vi.advanceTimersByTimeAsync(9000);
        expect(checkEventStatus).not.toHaveBeenCalled();
    });

    it('checks immediately when the tab becomes visible again', async () => {
        await startPolling();
        setVisibility('hidden');
        await vi.advanceTimersByTimeAsync(1000);
        setVisibility('visible');
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(0);
        expect(checkEventStatus).toHaveBeenCalledTimes(1);
    });

    it('does not check when visibilitychange fires while hidden', async () => {
        await startPolling();
        setVisibility('hidden');
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(0);
        expect(checkEventStatus).not.toHaveBeenCalled();
    });

    it('still polls every 3 s while visible', async () => {
        await startPolling();
        await vi.advanceTimersByTimeAsync(6000);
        expect(checkEventStatus).toHaveBeenCalledTimes(2);
    });

    it('removes the visibility listener on unmount', async () => {
        await startPolling();
        cleanup();
        document.dispatchEvent(new Event('visibilitychange'));
        await vi.advanceTimersByTimeAsync(0);
        expect(checkEventStatus).not.toHaveBeenCalled();
    });
});

describe('TelegramConnect manager DM', () => {
    afterEach(() => cleanup());

    // Catches: the button calling dmManagerLink without its platform, which DMed every
    // linked platform (Telegram and Discord) instead of Telegram only.
    it('asks for the login link on Telegram only', async () => {
        const { dmManagerLink } = await import('@/features/event-management/server/recovery');
        vi.mocked(dmManagerLink).mockResolvedValue({ success: true, message: 'sent' });
        render(<TelegramConnect slug="evt" botUsername="bot" hasChatId={false} initialHandle={null} hasManagerChatId={true} />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Send Magic Link (Telegram DM)' }));
        });

        expect(dmManagerLink).toHaveBeenCalledWith('evt', 'telegram');
    });
});

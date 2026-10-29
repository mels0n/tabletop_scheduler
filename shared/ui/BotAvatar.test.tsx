import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const config = vi.hoisted(() => ({ isHosted: false }));
vi.mock('@/shared/config/public', () => ({ publicConfig: config }));

import { BotAvatar } from './BotAvatar';

afterEach(() => { config.isHosted = false; });

describe('BotAvatar', () => {
    it('renders nothing on a self-hosted instance, whose bot has its own avatar', () => {
        const { container } = render(<BotAvatar size={40} />);
        expect(container.innerHTML).toBe('');
    });

    it('renders the fallback instead of the avatar on a self-hosted instance', () => {
        render(<BotAvatar size={40} badge={<i />} fallback={<span>own icon</span>} />);
        expect(screen.getByText('own icon')).toBeTruthy();
        expect(screen.queryByRole('img')).toBeNull();
        expect(screen.queryByTestId('bot-avatar-badge')).toBeNull();
    });

    it('serves the small file up to 96px and the large one above it when hosted', () => {
        config.isHosted = true;
        for (const [size, file] of [[40, 'avatar-96'], [96, 'avatar-96'], [97, 'avatar-384'], [160, 'avatar-384']] as const) {
            const { container, unmount } = render(<BotAvatar size={size} fallback={<span>own icon</span>} />);
            expect(container.querySelector('img')?.getAttribute('src')).toBe(`/images/bot/${file}.webp`);
            expect(screen.queryByText('own icon')).toBeNull();
            unmount();
        }
    });

    it('shows the platform badge hidden from assistive tech when hosted', () => {
        config.isHosted = true;
        render(<BotAvatar size={40} badge={<i data-testid="mark" />} />);
        const badge = screen.getByTestId('bot-avatar-badge');
        expect(badge.getAttribute('aria-hidden')).toBe('true');
        expect(badge.contains(screen.getByTestId('mark'))).toBe(true);
    });

    it('names the bot by default and goes silent when decorative', () => {
        config.isHosted = true;
        const { unmount } = render(<BotAvatar size={40} />);
        expect(screen.getByRole('img', { name: 'Tabletop Time bot avatar' })).toBeTruthy();
        unmount();
        const { container } = render(<BotAvatar size={40} decorative />);
        expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
    });
});

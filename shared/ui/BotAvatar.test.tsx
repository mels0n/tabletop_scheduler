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

    it('serves the small file for small sizes and the large one above 96px when hosted', () => {
        config.isHosted = true;
        const { unmount } = render(<BotAvatar size={40} />);
        expect(screen.getByRole('img').getAttribute('src')).toBe('/images/bot/avatar-96.webp');
        unmount();
        render(<BotAvatar size={160} />);
        expect(screen.getByRole('img').getAttribute('src')).toBe('/images/bot/avatar-384.webp');
    });
});

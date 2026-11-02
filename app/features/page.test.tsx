import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const config = vi.hoisted(() => ({ isHosted: false, baseUrl: null, botName: null }));
vi.mock('@/shared/config/public', () => ({ publicConfig: config }));

import FeaturesPage from './page';

afterEach(() => { config.isHosted = false; });

const guideLinks = (container: HTMLElement) =>
    container.querySelectorAll('a[href="/guide/telegram-setup"], a[href="/guide/discord-setup"]');

describe('FeaturesPage: Telegram and Discord section', () => {
    // The setup guides call notFound() on hosted, so linking them there is a dead end.
    it('introduces the hosted bot instead of linking the self-host setup guides', () => {
        config.isHosted = true;
        const { container } = render(<FeaturesPage />);
        expect(screen.getByRole('heading', { name: 'Meet the bot' })).toBeTruthy();
        expect(screen.getByRole('img', { name: 'Tabletop Time bot avatar' })).toBeTruthy();
        expect(guideLinks(container)).toHaveLength(0);
    });

    it('links the setup guides on a self-hosted instance', () => {
        const { container } = render(<FeaturesPage />);
        expect(screen.queryByRole('heading', { name: 'Meet the bot' })).toBeNull();
        expect(guideLinks(container)).toHaveLength(2);
    });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
    usePathname: () => '/e/evt/manage',
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/features/integrations/discord/server/actions', () => ({
    listDiscordChannels: vi.fn().mockResolvedValue({ channels: [] }),
    connectDiscordChannel: vi.fn(),
    dmDiscordManagerLink: vi.fn(),
}));

import { DiscordConnect } from './DiscordConnect';

const oauthLinks = () => screen.queryAllByRole('link').filter(a => a.getAttribute('href')?.startsWith('/api/auth/discord'));

describe('DiscordConnect: OAuth links', () => {
    it('shows the connect and recover links when Discord OAuth is configured', () => {
        render(<DiscordConnect slug="evt" hasChannel={false} hasManagerDiscordId={false} oauthEnabled />);
        expect(screen.getByRole('link', { name: 'Connect Discord Server' })).toBeTruthy();
        expect(screen.getByRole('link', { name: /Recover with Discord/ })).toBeTruthy();
    });

    it('renders no link into the OAuth flow when Discord OAuth is not configured', () => {
        render(<DiscordConnect slug="evt" hasChannel={false} hasManagerDiscordId={false} oauthEnabled={false} />);
        expect(oauthLinks()).toHaveLength(0);
    });

    it('keeps a bound channel visible but offers no reconnect or recover link without OAuth', () => {
        render(<DiscordConnect slug="evt" hasChannel guildId="1" channelId="2" hasManagerDiscordId={false} oauthEnabled={false} />);
        fireEvent.click(screen.getByRole('button', { name: /manage/ }));
        expect(screen.queryByRole('button', { name: 'reconnect channel' })).toBeNull();
        expect(oauthLinks()).toHaveLength(0);
    });
});

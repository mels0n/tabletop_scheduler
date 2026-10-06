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
import { listDiscordChannels } from '@/features/integrations/discord/server/actions';

const oauthLinks = () => screen.queryAllByRole('link').filter(a => a.getAttribute('href')?.startsWith('/api/auth/discord'));

describe('DiscordConnect: OAuth links', () => {
    it('shows the connect and recover links when Discord OAuth is configured', () => {
        render(<DiscordConnect slug="evt" hasChannel={false} hasManagerDiscordId={false} oauthEnabled />);
        expect(screen.getByRole('link', { name: 'Connect Discord Server' })).toBeTruthy();
        expect(screen.getByRole('link', { name: /Recover with Discord/ })).toBeTruthy();
    });

    it('renders nothing without OAuth, a bound channel or a linked manager', () => {
        const { container } = render(<DiscordConnect slug="evt" hasChannel={false} hasManagerDiscordId={false} oauthEnabled={false} />);
        expect(container.innerHTML).toBe('');
    });

    it('keeps a bound channel visible but offers no reconnect or empty manage panel without OAuth', () => {
        render(<DiscordConnect slug="evt" hasChannel guildId="1" channelId="2" hasManagerDiscordId={false} oauthEnabled={false} />);
        expect(screen.getByText('connected')).toBeTruthy();
        expect(screen.queryByRole('button', { name: /manage/ })).toBeNull();
        expect(oauthLinks()).toHaveLength(0);
    });

    it('keeps DM recovery for a linked manager on a bound channel without OAuth', () => {
        render(<DiscordConnect slug="evt" hasChannel guildId="1" channelId="2" hasManagerDiscordId oauthEnabled={false} />);
        fireEvent.click(screen.getByRole('button', { name: /manage/ }));
        expect(screen.queryByRole('button', { name: 'reconnect channel' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Send Magic Link (Discord DM)' })).toBeTruthy();
        expect(oauthLinks()).toHaveLength(0);
    });

    it('offers reconnect on a bound channel with OAuth', () => {
        render(<DiscordConnect slug="evt" hasChannel guildId="1" channelId="2" hasManagerDiscordId={false} oauthEnabled />);
        fireEvent.click(screen.getByRole('button', { name: /manage/ }));
        expect(screen.getByRole('button', { name: 'reconnect channel' })).toBeTruthy();
        expect(screen.getByRole('link', { name: /Recover with Discord/ })).toBeTruthy();
    });

    it('keeps DM recovery for a linked manager with no channel and no OAuth, without the setup box', () => {
        render(<DiscordConnect slug="evt" hasChannel={false} hasManagerDiscordId oauthEnabled={false} />);
        expect(screen.queryByText('Connect Discord Notifications')).toBeNull();
        expect(screen.getByRole('button', { name: 'Send Magic Link (Discord DM)' })).toBeTruthy();
        expect(oauthLinks()).toHaveLength(0);
    });

    it('shows the re-invite link while picking a channel only with OAuth', async () => {
        const { unmount } = render(<DiscordConnect slug="evt" hasChannel={false} guildId="1" hasManagerDiscordId={false} oauthEnabled />);
        expect((await screen.findByRole('link', { name: 'Re-invite it' })).getAttribute('href')).toBe('/api/auth/discord?flow=connect&returnTo=%2Fe%2Fevt%2Fmanage');
        unmount();

        vi.mocked(listDiscordChannels).mockClear();
        render(<DiscordConnect slug="evt" hasChannel={false} guildId="1" hasManagerDiscordId oauthEnabled={false} />);
        await screen.findByRole('button', { name: 'Send Magic Link (Discord DM)' });
        expect(oauthLinks()).toHaveLength(0);
        // The picker follows the OAuth bot-add flow, so its channel list is never fetched.
        expect(listDiscordChannels).not.toHaveBeenCalled();
    });
});

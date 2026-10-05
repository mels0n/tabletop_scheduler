import { describe, it, expect, vi, beforeEach } from 'vitest';

const discord = { botToken: null as string | null, appId: null as string | null, clientSecret: null as string | null };
vi.mock('@/shared/config/server', () => ({ getServerConfig: () => ({ discord }) }));

import { isDiscordOAuthConfigured } from './oauth-config';

describe('isDiscordOAuthConfigured', () => {
    beforeEach(() => {
        discord.appId = null;
        discord.clientSecret = null;
    });

    it('is false with no Discord app configured', () => {
        expect(isDiscordOAuthConfigured()).toBe(false);
    });

    it('is false with an app id but no client secret (the callback would fail)', () => {
        discord.appId = 'app';
        expect(isDiscordOAuthConfigured()).toBe(false);
    });

    it('is true with both the app id and the client secret', () => {
        discord.appId = 'app';
        discord.clientSecret = 'secret';
        expect(isDiscordOAuthConfigured()).toBe(true);
    });
});

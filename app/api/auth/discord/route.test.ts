import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from './route';

function start(query: string) {
    return GET(new Request(`http://localhost:3000/api/auth/discord${query}`));
}

describe('GET /api/auth/discord', () => {
    beforeEach(() => {
        process.env.DISCORD_APP_ID = 'app-id';
    });

    it('puts a random nonce in state and in a short-lived httpOnly cookie', async () => {
        const res = await start('?flow=connect&returnTo=%2Fe%2Fabc%2Fmanage');

        const location = new URL(res.headers.get('location')!);
        const state = JSON.parse(location.searchParams.get('state')!);
        expect(state).toMatchObject({ flow: 'connect', returnTo: '/e/abc/manage' });
        expect(state.nonce).toMatch(/^[A-Za-z0-9_-]{22}$/);

        const cookie = res.cookies.get('tabletop_oauth_nonce');
        expect(cookie?.value).toBe(state.nonce);
        expect(cookie?.httpOnly).toBe(true);
        expect(cookie?.maxAge).toBe(600);
    });

    it('uses a fresh nonce per request', async () => {
        const a = (await start('')).cookies.get('tabletop_oauth_nonce')?.value;
        const b = (await start('')).cookies.get('tabletop_oauth_nonce')?.value;
        expect(a).toBeTruthy();
        expect(a).not.toBe(b);
    });

    it('sanitises returnTo and flow before they reach state', async () => {
        const res = await start('?flow=evil&returnTo=https%3A%2F%2Fevil.example');
        const state = JSON.parse(new URL(res.headers.get('location')!).searchParams.get('state')!);
        expect(state.returnTo).toBe('/');
        expect(state.flow).toBe('login');
    });
});

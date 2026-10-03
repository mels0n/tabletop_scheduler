import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';
import { signValue } from '@/shared/lib/session';

function req(path: string, cookies: Record<string, string>) {
    const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    return new NextRequest(`http://localhost:3000${path}`, { headers: { cookie } });
}

/** Parsed Set-Cookie headers by name. */
function setCookies(res: Response): Map<string, string> {
    const out = new Map<string, string>();
    for (const line of res.headers.getSetCookie()) {
        const name = line.slice(0, line.indexOf('='));
        out.set(name, line);
    }
    return out;
}

describe('proxy sliding refresh', () => {
    it('re-sets a signed identity cookie with a fresh max-age', () => {
        const signed = signValue('987654321');
        const res = proxy(req('/e/abc', { tabletop_user_discord_id: signed, tabletop_user_discord_name: 'Chris' }));
        const sc = setCookies(res);
        expect(sc.get('tabletop_user_discord_id')).toContain(`tabletop_user_discord_id=${encodeURIComponent(signed)}`);
        expect(sc.get('tabletop_user_discord_id')).toMatch(/Max-Age=34560000/);
        expect(sc.get('tabletop_user_discord_id')).toMatch(/HttpOnly/i);
        expect(sc.get('tabletop_user_discord_name')).toMatch(/Max-Age=34560000/);
        expect(sc.get('tabletop_user_discord_name')).not.toMatch(/HttpOnly/i);
    });

    it('deletes an unsigned identity cookie and its display-name cookie', () => {
        const res = proxy(req('/e/abc', { tabletop_user_chat_id: '555', tabletop_user_telegram_name: 'bob' }));
        const sc = setCookies(res);
        expect(sc.get('tabletop_user_chat_id')).toMatch(/tabletop_user_chat_id=;/);
        expect(sc.get('tabletop_user_chat_id')).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/);
        expect(sc.get('tabletop_user_telegram_name')).toMatch(/tabletop_user_telegram_name=;/);
    });

    it('still refreshes admin cookies', () => {
        const res = proxy(req('/e/abc', { tabletop_admin_abc: 'raw-token' }));
        expect(setCookies(res).get('tabletop_admin_abc')).toMatch(/Max-Age=34560000/);
    });
});

describe('proxy manage gate', () => {
    it('redirects /manage when the only identity cookie is unsigned', () => {
        const res = proxy(req('/e/abc/manage', { tabletop_user_discord_id: '987654321' }));
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toBe('http://localhost:3000/e/abc?action=login');
    });

    it('lets /manage through with a signed identity cookie', () => {
        const res = proxy(req('/e/abc/manage', { tabletop_user_discord_id: signValue('987654321') }));
        expect(res.headers.get('location')).toBeNull();
    });

    it('lets /manage through with an admin cookie', () => {
        const res = proxy(req('/e/abc/manage', { tabletop_admin_abc: 'raw-token' }));
        expect(res.headers.get('location')).toBeNull();
    });
});

describe('proxy request ids', () => {
    it('mints an id, echoes it on the response and forwards it on the request', () => {
        const res = proxy(req('/e/abc', {}));
        const id = res.headers.get('x-request-id');
        expect(id).toMatch(/^[0-9a-f-]{36}$/);
        expect(res.headers.get('x-middleware-request-x-request-id')).toBe(id);
    });

    it('reuses a well-formed incoming id', () => {
        const request = new NextRequest('http://localhost:3000/api/health', { headers: { 'x-request-id': 'lb-42' } });
        const res = proxy(request);
        expect(res.headers.get('x-request-id')).toBe('lb-42');
    });

    it('tags API routes without touching cookies', () => {
        const res = proxy(req('/api/event/abc/vote', { tabletop_admin_abc: 'raw-token' }));
        expect(res.headers.get('x-request-id')).toBeTruthy();
        expect(res.headers.getSetCookie()).toEqual([]);
    });

    it('tags the manage redirect too', () => {
        const res = proxy(req('/e/abc/manage', {}));
        expect(res.status).toBe(307);
        expect(res.headers.get('x-request-id')).toBeTruthy();
    });
});

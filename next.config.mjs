/**
 * Security headers applied to every route (Vercel and Docker alike).
 * CSP ships as Report-Only first: app/layout.tsx emits inline JSON-LD, so an
 * enforcing policy needs nonces or hashes before it can be switched on.
 */
const securityHeaders = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    // includeSubDomains only on the hosted site: a self-hoster on a shared parent domain must
    // not opt every sibling subdomain into HTTPS-only.
    {
        key: 'Strict-Transport-Security',
        value: process.env.NEXT_PUBLIC_IS_HOSTED === 'true' ? 'max-age=63072000; includeSubDomains' : 'max-age=63072000',
    },
    {
        key: 'Content-Security-Policy-Report-Only',
        value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'",
    },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: process.env.IS_DOCKER_BUILD === 'true' ? 'standalone' : undefined,
    serverExternalPackages: ['@prisma/client'],
    // next/image is never used; disabling the optimizer removes the /_next/image endpoint.
    images: { unoptimized: true },
    // Next 16.3 writes agent rule files into the project by default; this repo manages its own.
    agentRules: false,
    async headers() {
        return [{ source: '/(.*)', headers: securityHeaders }];
    },
};

export default nextConfig;

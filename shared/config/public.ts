/**
 * Public (browser-safe) configuration. Each value is a literal `process.env.NEXT_PUBLIC_*`
 * read so Next.js inlines it at build time; do not destructure or index `process.env` here.
 */
export const publicConfig = {
    isHosted: process.env.NEXT_PUBLIC_IS_HOSTED === "true",
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL ? process.env.NEXT_PUBLIC_BASE_URL.replace(/\/+$/, "") : null,
    botName: process.env.NEXT_PUBLIC_BOT_NAME || null,
} as const;

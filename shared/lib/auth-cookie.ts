export const COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // 400 days (Browser Maximum)

export const COOKIE_BASE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax covers every flow this app has (magic links and the OAuth callback are
    // top-level navigations). None would mark these cookies third-party-capable,
    // making them targets for browser tracking-prevention purges.
    sameSite: "lax" as const,
    path: "/",
};

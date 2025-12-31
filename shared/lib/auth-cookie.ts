export const COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // 400 days (Browser Maximum)

export const COOKIE_BASE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
    path: "/",
};

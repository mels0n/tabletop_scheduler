import { getServerConfig } from "@/shared/config/server";
import { ConfigError } from "@/shared/errors";

/**
 * The canonical public origin (no trailing slash), from `NEXT_PUBLIC_BASE_URL`.
 * Never derived from request headers: links built from `Host`/`X-Forwarded-Host`
 * can be poisoned, and magic links carry admin tokens.
 *
 * @throws {ConfigError} when no base URL is configured.
 */
export function getBaseUrl(): string {
    const { baseUrl } = getServerConfig();
    if (!baseUrl) {
        throw new ConfigError("NEXT_PUBLIC_BASE_URL is not set; cannot build absolute links");
    }
    return baseUrl;
}

/**
 * Display-only origin for links shown back to the same requester (for example the event
 * link inside a downloaded .ics). Prefers the configured base URL, else the request's own
 * host. NEVER use for links delivered to anyone else (magic links, bot messages, redirects
 * carrying tokens): a forged `Host` header would poison them. Use `getBaseUrl()` for those.
 */
export function getBaseUrlFromHeaders(headers: Headers): string {
    const { baseUrl } = getServerConfig();
    if (baseUrl) return baseUrl;
    const host = headers.get("host");
    const proto = (headers.get("x-forwarded-proto") ?? "http").split(",")[0].trim();
    return host ? `${proto === "https" ? "https" : "http"}://${host}` : "http://localhost:3000";
}

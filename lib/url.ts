/**
 * @function getBaseUrl
 * @description Determines the fully qualified base URL of the application.
 *
 * logic Priority:
 * 1. Environment Variable (`NEXT_PUBLIC_BASE_URL`): Essential for scenarios where the
 *    request header might be missing or incorrect (e.g., serverless warm-up, build time, or certain proxies).
 * 2. Request Headers (`x-forwarded-host`): Standard proxy headers used to determine the original
 *    host requested by the client, even if the node process is running on localhost internal to a cluster.
 * 3. Fallback (`localhost:3000`): Safe default for local development.
 *
 * @param {Headers} [headers] - The HTTP request headers (optional).
 * @returns {string} The normalized base URL without trailing slash.
 */
export function getBaseUrl(headers?: Headers | null) {
    // Priority 0: Environment Variable (Critical for Webhook Setup & Serverless)
    if (process.env.NEXT_PUBLIC_BASE_URL) {
        // Intent: Normalize by removing trailing slash to prevent double-slashes in generated links.
        return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
    }

    // Priority 1: Dynamic Headers (Standard X-Forwarded-For pattern)
    // This allows the app to adapt to whatever domain it's currently accessed from.
    if (headers) {
        const host = headers.get("x-forwarded-host") || headers.get("host");
        const protocol = headers.get("x-forwarded-proto") || "http";
        // Intent: Handle comma-separated protocols (e.g., "https, http" from some Load Balancers)
        const proto = (typeof protocol === 'string' ? protocol.split(',')[0].trim() : "http");
        if (host) return `${proto}://${host}`;
    }

    // Priority 2: Localhost Fallback
    return "http://localhost:3000";
}

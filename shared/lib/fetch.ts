import Logger from "@/shared/lib/logger";

const log = Logger.get("Fetch");

export interface ReliableFetchOptions extends RequestInit {
    /** Time in milliseconds before the request is aborted. Default: 8000 (8 seconds) */
    timeoutMs?: number;
    /** Number of retry attempts on 5xx errors, 429 rate limits, or network failures. Default: 2 */
    retries?: number;
    /** Exponential backoff base delay in milliseconds. Default: 500 */
    retryDelayMs?: number;
}

/**
 * Longest rate-limit wait we will honor before giving up. Vercel serverless invocations
 * have a hard duration budget, so a Retry-After beyond this returns the 429 to the caller
 * instead of hanging the function.
 */
const MAX_RETRY_AFTER_MS = 10_000;

/**
 * Extracts the server-requested retry delay from a 429 response, in milliseconds.
 * Sources, in order: the Retry-After header (seconds, possibly fractional), then the
 * JSON body's `retry_after` (Discord sends seconds as a float on API v10; older
 * versions sent milliseconds — values that look too large to be seconds are treated
 * as ms). Returns null when the response carries no usable delay.
 */
async function getRetryAfterMs(res: Response): Promise<number | null> {
    const header = res.headers.get('retry-after');
    if (header) {
        const seconds = parseFloat(header);
        if (!isNaN(seconds) && seconds >= 0) return seconds * 1000;
    }

    try {
        const body = await res.clone().json();
        const value = body?.retry_after;
        if (typeof value === 'number' && value >= 0) {
            return value > 100 ? value : value * 1000;
        }
    } catch {
        // No JSON body — fall through to null.
    }

    return null;
}

/**
 * A wrapper around native fetch that adds a hard timeout and retry logic for network transients.
 * Prevents Server Actions from hanging indefinitely on Vercel edge proxies and handles Undici ECONNRESET.
 */
export async function reliableFetch(url: string | URL, options: ReliableFetchOptions = {}): Promise<Response> {
    const { 
        timeoutMs = 8000, 
        retries = 2, 
        retryDelayMs = 500, 
        ...fetchOptions 
    } = options;

    let attempt = 0;

    while (attempt <= retries) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            // Merge any existing signal with our timeout signal
            const signal = options.signal 
                ? (AbortSignal as any).any([options.signal, controller.signal]) 
                : controller.signal;

            const res = await fetch(url, { ...fetchOptions, signal });
            clearTimeout(timeoutId);

            // Rate limited: honor the server's requested delay, capped so a serverless
            // invocation can't be held hostage by a long Retry-After. An uncapped or
            // final-attempt 429 is returned to the caller as-is.
            if (res.status === 429 && attempt < retries) {
                const retryAfterMs = await getRetryAfterMs(res);

                if (retryAfterMs !== null && retryAfterMs > MAX_RETRY_AFTER_MS) {
                    log.warn(`Rate limited with Retry-After ${retryAfterMs}ms > cap; giving up`, { url: url.toString() });
                    return res;
                }

                const waitMs = retryAfterMs ?? retryDelayMs * Math.pow(2, attempt);
                log.warn(`Rate limited (Attempt ${attempt + 1}/${retries + 1}); retrying in ${waitMs}ms`, { url: url.toString() });
                await new Promise(resolve => setTimeout(resolve, waitMs));
                attempt++;
                continue;
            }

            // Retry on 5xx Server Errors
            if (!res.ok && res.status >= 500) {
                if (attempt < retries) {
                    log.warn(`API 5xx Error (Attempt ${attempt + 1}/${retries + 1}): ${res.status}`, { url: url.toString() });
                    throw new Error(`HTTP ${res.status}`);
                }
            }

            return res;

        } catch (error) {
            const isTimeout = (error as Error).name === 'AbortError' || (error as Error).name === 'TimeoutError';
            const msg = isTimeout ? 'Request timed out' : (error as Error).message;

            if (attempt >= retries) {
                log.error(`API Fetch Failed permanently after ${attempt} retries: ${msg}`, { url: url.toString() });
                throw error;
            }

            log.warn(`API Fetch Failed (Attempt ${attempt + 1}/${retries + 1}): ${msg}`, { url: url.toString() });
            
            // Wait before next attempt with exponential backoff
            await new Promise(resolve => setTimeout(resolve, retryDelayMs * Math.pow(2, attempt)));
            attempt++;
        }
    }

    throw new Error("unreachable");
}

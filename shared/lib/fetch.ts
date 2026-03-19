import Logger from "@/shared/lib/logger";

const log = Logger.get("Fetch");

export interface ReliableFetchOptions extends RequestInit {
    /** Time in milliseconds before the request is aborted. Default: 8000 (8 seconds) */
    timeoutMs?: number;
    /** Number of retry attempts on 5xx errors or network failures. Default: 2 */
    retries?: number;
    /** Exponential backoff base delay in milliseconds. Default: 500 */
    retryDelayMs?: number;
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

            // Retry on 5xx Server Errors (Rate limits 429 should ideally be respected differently, but we omit here)
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

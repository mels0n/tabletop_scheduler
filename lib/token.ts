import crypto from 'crypto';

const SECRET = process.env.TELEGRAM_BOT_TOKEN || "fallback-secret-for-dev";

// Intent: 15-minute window for security linkage. Short enough to prevent replay attacks, long enough for email/Telegram latency.
const EXPIRATION_SECONDS = 15 * 60;

/**
 * @function generateRecoveryToken
 * @description Creates a secure, time-bound token for recovering manager access.
 * Format: [timestamp]-[HMAC Signature]
 *
 * @param {string} slug - The event identifier to lock this token to.
 * @returns {string} The formatted token string.
 */
export function generateRecoveryToken(slug: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = sign(slug, timestamp);
    return `${timestamp}-${signature}`;
}

/**
 * @function verifyRecoveryToken
 * @description Validates a recovery token's integrity and expiration.
 *
 * Checks:
 * 1. Timestamp validity (must be within the last 15 minutes).
 * 2. Signature match (ensures token wasn't tampered with).
 *
 * @param {string} slug - The event slug to verify against.
 * @param {string} token - The token string to verify.
 * @returns {boolean} True if valid, False otherwise.
 */
export function verifyRecoveryToken(slug: string, token: string): boolean {
    if (!token || !token.includes('-')) return false;

    const [timestampStr, signature] = token.split('-');
    const timestamp = parseInt(timestampStr, 10);

    if (isNaN(timestamp)) return false;

    // 1. Check Expiration
    const now = Math.floor(Date.now() / 1000);
    if (now > timestamp + EXPIRATION_SECONDS) {
        return false;
    }

    // 2. Check Signature
    const expectedSignature = sign(slug, timestamp);

    // Intent: Constant-time comparison to prevent timing attacks.
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
}

/**
 * @function sign
 * @description Helper to generate HMAC-SHA256 signature.
 */
function sign(slug: string, timestamp: number): string {
    return crypto
        .createHmac('sha256', SECRET)
        .update(`${slug}:${timestamp}`)
        .digest('hex');
}

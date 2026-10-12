import { createHash, randomBytes } from "node:crypto";

const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Random bits in every newly minted slug, token and code. */
const TOKEN_BYTES = 16;

/** Base62 characters needed for 128 bits: ceil(128 / log2(62)). */
export const TOKEN_LENGTH = 22;

/**
 * Encodes 16 bytes as exactly 22 base62 characters (left-padded with "0"). 62^22 exceeds 2^128,
 * so every 128-bit value has its own encoding and no entropy is lost. Alphanumeric only, so the
 * result survives URLs, Telegram commands and deep links, and copy-paste from chat apps, which
 * trim or mangle base64url's `-` and `_`.
 */
export function toBase62(bytes: Uint8Array): string {
    if (bytes.length !== TOKEN_BYTES) throw new Error(`toBase62 expects ${TOKEN_BYTES} bytes`);
    let n = BigInt(`0x${Buffer.from(bytes).toString("hex")}`);
    let out = "";
    for (let i = 0; i < TOKEN_LENGTH; i++) {
        out = BASE62_ALPHABET[Number(n % BigInt(62))] + out;
        n /= BigInt(62);
    }
    return out;
}

/**
 * A fresh secret: 128 random bits as 22 base62 characters. Used for event slugs and for admin,
 * login and recovery tokens. Lookups are by exact slug or by `hashToken`, so slugs and tokens
 * minted in older formats (8 hex chars, UUIDs, 14-char slugs) keep working unchanged.
 */
export function newToken(): string {
    return toBase62(randomBytes(TOKEN_BYTES));
}

/**
 * Creates a SHA-256 hash of the provided token.
 * Used for securely storing authentication tokens (Admin, Recovery, Login) in the database.
 * 
 * @param token The plaintext token.
 * @returns The hex-encoded hash.
 */
export function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

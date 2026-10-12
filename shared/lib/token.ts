import { createHash, randomBytes } from "node:crypto";

/** Random bytes in every newly minted secret token: 128 bits. */
export const TOKEN_BYTES = 16;

/**
 * A fresh secret token: 128 random bits as 32 lowercase hex characters. Used for admin,
 * login and recovery tokens. Tokens are only ever compared through `hashToken`, so tokens
 * minted in an older format (UUIDs, 8 hex characters) keep working unchanged.
 */
export function newToken(): string {
    return randomBytes(TOKEN_BYTES).toString("hex");
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

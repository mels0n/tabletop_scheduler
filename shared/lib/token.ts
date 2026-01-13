import { createHash } from "node:crypto";

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

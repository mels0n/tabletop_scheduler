import { createHash, timingSafeEqual } from "node:crypto";
import { getServerConfig } from "@/shared/config/server";
import { UnauthorizedError } from "@/shared/errors";

const LOOPBACK_HOST = /^(127\.0\.0\.1|localhost)(:\d+)?$/i;

/** Constant-time string compare; hashing first removes the length side channel. */
function safeEqual(a: string, b: string): boolean {
    const ha = createHash("sha256").update(a).digest();
    const hb = createHash("sha256").update(b).digest();
    return timingSafeEqual(ha, hb);
}

/**
 * Authorizes cron and maintenance endpoints. Fails closed: passes only with
 * `Authorization: Bearer <CRON_SECRET>`, or, on a self-hosted box with no secret
 * configured, when the request targets a loopback host. Throws `UnauthorizedError`.
 */
export function requireCronAuth(req: Request): void {
    const { cronSecret, isHosted } = getServerConfig();

    if (cronSecret) {
        const header = req.headers.get("authorization") ?? "";
        const match = /^Bearer (.+)$/.exec(header);
        if (match && safeEqual(match[1], cronSecret)) return;
        throw new UnauthorizedError();
    }

    if (!isHosted) {
        let host = req.headers.get("host");
        if (!host) {
            try {
                host = new URL(req.url).host;
            } catch {
                host = null;
            }
        }
        if (host && LOOPBACK_HOST.test(host)) return;
    }

    throw new UnauthorizedError();
}

import { createHash, timingSafeEqual } from "node:crypto";
import { getServerConfig } from "@/shared/config/server";
import { UnauthorizedError } from "@/shared/errors";
import Logger from "@/shared/lib/logger";

const log = Logger.get("CronAuth");
let warnedNoSecret = false;

/** Constant-time string compare; hashing first removes the length side channel. */
function safeEqual(a: string, b: string): boolean {
    const ha = createHash("sha256").update(a).digest();
    const hb = createHash("sha256").update(b).digest();
    return timingSafeEqual(ha, hb);
}

/**
 * Authorizes cron and maintenance endpoints. Fails closed: passes only with
 * `Authorization: Bearer <CRON_SECRET>`. With no secret configured every request is
 * rejected (the Docker entrypoint always generates one). Throws `UnauthorizedError`.
 */
export function requireCronAuth(req: Request): void {
    const { cronSecret } = getServerConfig();

    if (!cronSecret) {
        if (!warnedNoSecret) {
            warnedNoSecret = true;
            log.warn("CRON_SECRET is unset; every cron and maintenance request is rejected");
        }
        throw new UnauthorizedError();
    }

    const header = req.headers.get("authorization") ?? "";
    const match = /^Bearer (.+)$/.exec(header);
    if (match && safeEqual(match[1], cronSecret)) return;
    throw new UnauthorizedError();
}

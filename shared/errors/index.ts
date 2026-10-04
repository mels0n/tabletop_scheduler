import { NextResponse } from "next/server";
import { ZodError } from "zod";
import Logger from "@/shared/lib/logger";
import { AppError } from "./errors";

export * from "./errors";

function isZodError(err: unknown): err is ZodError {
    return err instanceof ZodError
        || (err instanceof Error && err.name === "ZodError" && Array.isArray((err as ZodError).issues));
}

/** Duck-typed so it works across duplicated Prisma client bundles and with the test mock. */
function prismaCode(err: unknown): string | null {
    if (typeof err !== "object" || err === null) return null;
    const { name, code } = err as { name?: unknown; code?: unknown };
    if (name !== "PrismaClientKnownRequestError" || typeof code !== "string") return null;
    return code;
}

let defaultLog: Logger | null = null;

/**
 * Maps any thrown value to a JSON response. Expected errors keep their status and message;
 * server-side failures are logged and returned as a generic 500 so internals never leak.
 */
export function toResponse(err: unknown, log?: Logger): NextResponse {
    const logger = log ?? (defaultLog ??= Logger.get("Errors"));

    if (err instanceof AppError) {
        if (err.status >= 500) {
            logger.error(err.message, { error: err });
            return NextResponse.json({ error: "Internal error", code: err.code }, { status: err.status });
        }
        return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }

    if (isZodError(err)) {
        return NextResponse.json(
            { error: "Invalid request", code: "validation", issues: err.issues },
            { status: 400 },
        );
    }

    const code = prismaCode(err);
    if (code === "P2025") {
        return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
    }
    if (code === "P2002") {
        return NextResponse.json({ error: "Conflict", code: "conflict" }, { status: 409 });
    }

    logger.error("Unhandled error", err instanceof Error ? { error: err } : { error: String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
}

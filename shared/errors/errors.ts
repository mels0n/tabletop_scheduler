/**
 * Typed domain errors. This file has no imports so that low-level modules
 * (the config loader in particular) can throw these without pulling in the
 * logger, which itself reads the config.
 */
/**
 * Base class for every expected, typed failure. Route handlers and server actions throw
 * these; `toResponse` is the one place they are mapped to HTTP.
 */
export class AppError extends Error {
    constructor(message: string, readonly status: number, readonly code: string) {
        super(message);
        this.name = new.target.name;
    }
}

export class ValidationError extends AppError {
    constructor(message = "Invalid request") {
        super(message, 400, "validation");
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized") {
        super(message, 401, "unauthorized");
    }
}

export class ForbiddenError extends AppError {
    constructor(message = "Forbidden") {
        super(message, 403, "forbidden");
    }
}

export class NotFoundError extends AppError {
    constructor(message = "Not found") {
        super(message, 404, "not_found");
    }
}

export class ConflictError extends AppError {
    constructor(message = "Conflict") {
        super(message, 409, "conflict");
    }
}

export class RateLimitError extends AppError {
    constructor(message = "Too many requests") {
        super(message, 429, "rate_limited");
    }
}

export class ConfigError extends AppError {
    constructor(message: string) {
        super(message, 500, "config");
    }
}

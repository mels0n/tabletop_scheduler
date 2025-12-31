import { PrismaClient } from '@prisma/client';

/**
 * @function prismaClientSingleton
 * @description Creates a new instance of the Prisma Client.
 * Configures logging based on environment variables for debugging.
 *
 * @returns {PrismaClient} Fresh client instance.
 */
const prismaClientSingleton = () => {
    // Intent: Log queries in debug mode only to reduce noise in production.
    const isDebug = process.env.LOG_LEVEL === 'debug';
    return new PrismaClient({
        log: isDebug ? ['query', 'error', 'warn'] : ['error', 'warn'],
    });
};

/**
 * @global
 * @description Extends the global namespace to include the Prisma instance type.
 * Required for TypeScript to recognize the global variable used in hot-reload preservation.
 */
declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

/**
 * @constant prisma
 * @description The shared Prisma Client instance.
 *
 * Pattern: Singleton.
 * Why? In Next.js development (hot-reload), creates a new Node.js process frequently.
 * Creating a new PrismaClient each time exhausts the database connection pool.
 * We attach the instance to `globalThis` to preserve it across reloads in dev.
 */
const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = prisma;
}

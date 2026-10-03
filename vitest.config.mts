import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.dirname(fileURLToPath(import.meta.url)),
        },
    },
    test: {
        setupFiles: ['./vitest.setup.ts'],
        coverage: {
            provider: 'v8',
        },
        // Server code and libraries run in node; only component tests (.test.tsx) need a DOM.
        projects: [
            {
                extends: true,
                test: {
                    name: 'node',
                    environment: 'node',
                    include: ['**/*.test.ts'],
                    exclude: ['**/node_modules/**', '**/.next/**'],
                },
            },
            {
                extends: true,
                test: {
                    name: 'jsdom',
                    environment: 'jsdom',
                    include: ['**/*.test.tsx'],
                    exclude: ['**/node_modules/**', '**/.next/**'],
                },
            },
        ],
    },
});

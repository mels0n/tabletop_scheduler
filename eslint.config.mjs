import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
    globalIgnores([
        ".next/**",
        "out/**",
        "build/**",
        "coverage/**",
        "next-env.d.ts",
        "app/generated/**",
        "scratch/**",
        "tmp/**",
        "shared/data/published-posts.generated.ts",
    ]),
    js.configs.recommended,
    ...nextCoreWebVitals,
    ...nextTypescript,
    {
        // eslint-plugin-react 7.x calls context.getFilename() to auto-detect the React
        // version, and ESLint 10 removed that API. Pinning the version skips detection.
        settings: { react: { version: "19.3" } },
    },
    {
        rules: {
            // Pre-existing debt (~160 sites); typing them is tracked as its own cleanup.
            "@typescript-eslint/no-explicit-any": "off",
            // React Compiler rules new in eslint-plugin-react-hooks 7. Satisfying them means
            // restructuring client components, which is out of scope for the framework upgrade.
            // rules-of-hooks and exhaustive-deps stay on.
            "react-hooks/set-state-in-effect": "off",
            "react-hooks/refs": "off",
            "react-hooks/immutability": "off",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    destructuredArrayIgnorePattern: "^_",
                    caughtErrors: "none",
                },
            ],
        },
    },
    {
        // Raw blog posts are read only by scripts/generate-published-posts.mjs (and the queue
        // inspector); the site reads the generated module through shared/lib/blog.ts.
        ignores: ["scripts/generate-published-posts.mjs", "scripts/blog-queue.mjs", "eslint.config.mjs", ".dependency-cruiser.cjs"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    paths: [
                        {
                            name: "gray-matter",
                            message: "Raw blog posts are read only by scripts/generate-published-posts.mjs. Use shared/lib/blog.",
                        },
                    ],
                    patterns: [
                        {
                            regex: "(^|/)content/blog",
                            message: "Raw blog posts are read only by scripts/generate-published-posts.mjs. Use shared/lib/blog.",
                        },
                        {
                            regex: "published-posts\\.generated$",
                            message: "Import posts through shared/lib/blog, not the generated module.",
                        },
                    ],
                },
            ],
            "no-restricted-syntax": [
                "error",
                {
                    selector: "Literal[value=/content[\\/]blog/]",
                    message: "Raw blog posts are read only by scripts/generate-published-posts.mjs. Use shared/lib/blog.",
                },
                {
                    selector: "CallExpression > Literal[value='content'] + Literal[value='blog']",
                    message: "Raw blog posts are read only by scripts/generate-published-posts.mjs. Use shared/lib/blog.",
                },
            ],
        },
    },
    {
        // The one reader of the generated module is shared/lib/blog.ts.
        files: ["shared/lib/blog.ts", "shared/lib/blog.test.ts"],
        rules: { "no-restricted-imports": "off" },
    },
    {
        // Node CommonJS scripts.
        files: ["**/*.js", "**/*.cjs"],
        rules: { "@typescript-eslint/no-require-imports": "off" },
    },
]);

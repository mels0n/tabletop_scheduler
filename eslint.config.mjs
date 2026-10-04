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
        // Node CommonJS scripts.
        files: ["**/*.js", "**/*.cjs"],
        rules: { "@typescript-eslint/no-require-imports": "off" },
    },
]);

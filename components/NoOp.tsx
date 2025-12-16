/**
 * @file NoOp.tsx
 * @description A null-object implementation used for build-time component replacement.
 *
 * @architecture
 * - Implements the Null Object pattern to replace "heavy" or "sensitive" components (e.g., AdSense, Analytics)
 *   in specific build environments (Docker/Self-Hosted).
 * - Configured via Webpack aliases in `next.config.mjs` based on the `IS_DOCKER_BUILD` environment variable.
 * - Ensures zero-bundle-size impact for excluded features and authentic privacy for self-hosted instances.
 */

/**
 * @component GoogleAdBar
 * @description A mock implementation of the GoogleAdBar that renders nothing.
 * Used when the real component is replaced via `next.config.js` aliases.
 *
 * @returns {null} Always returns null.
 */
export const GoogleAdBar = () => {
    return null;
};

export const GoogleAnalytics = () => {
    return null;
};

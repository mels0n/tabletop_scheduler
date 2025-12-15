/**
 * @file NoOp.tsx
 * @description A fallback "Null Object" component used for build-time replacement.
 *
 * @purpose Privacy & Security Compliance.
 * During Docker builds for self-hosted environments (where strict privacy is expected),
 * Webpack aliases are used to swap out "Noise" or "Tracking" components (like GoogleAdBar)
 * with this file. This ensures that no external trackers or ad scripts are included in the
 * final bundle for private instances.
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

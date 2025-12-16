# Privacy and Architecture

TabletopTime is designed with a "Privacy-First" philosophy for self-hosted instances, while supporting a sustainable "Hosted" model for the cloud version.

This document explains how we technically ensure that self-hosted (Docker) instances remain free of tracking, ads, and external dependencies.

## The "Hosted" vs "Self-Hosted" Split

The application behaves differently based on the deployment environment. This is controlled primarily by the `NEXT_PUBLIC_IS_HOSTED` environment variable.

| Feature | Self-Hosted / Docker | Hosted (Cloud) |
| :--- | :--- | :--- |
| **Google Analytics** | **Disabled** (Code removed) | Enabled |
| **Google AdSense** | **Disabled** (Code removed) | Enabled |
| **Robots.txt** | `Disallow: /` (No Crawl) | `Allow: /` |
| **Sitemap** | Hidden | Public |

## Technical Implementation: The "NoOp" Pattern

We don't just "hide" the analytics code with an `if` statement; we effectively remove it from the build entirely for Docker users.

### Webpack Aliasing (Build Time)

In `next.config.mjs`, we check if the build is running inside Docker (`IS_DOCKER_BUILD=true`). If so, we tell the bundler to replace the real Analytics and Ad components with a "Null Object" (NoOp).

```javascript
// next.config.mjs
if (process.env.IS_DOCKER_BUILD === 'true') {
    config.resolve.alias['@/components/GoogleAdBar'] = '@/components/NoOp';
    config.resolve.alias['@/components/GoogleAnalytics'] = '@/components/NoOp';
}
```

### The NoOp Component

The `components/NoOp.tsx` file exports empty components that render nothing (`null`).

```typescript
// components/NoOp.tsx
export const GoogleAnalytics = () => {
    return null; // Renders nothing, executes no code
};
```

### Benefit

This ensures that:
1.  **Zero Leakage**: The tracking scripts are not even present in the Javascript bundle sent to the client.
2.  **Performance**: Self-hosted instances don't download unnecessary bytes.
3.  **Trust**: You can verify the `Dockerfile` sets `IS_DOCKER_BUILD=true` to guarantee this behavior.

## SEO and Privacy

### Robots.txt & Meta Tags
For self-hosted (Docker) instances:
-   `app/robots.ts` generates a file disallowing all User Agents (`Disallow: /`).
-   `app/layout.tsx` injects `<meta name="robots" content="noindex, nofollow" />` into every page header.

This ensures your private game schedule is explicitly blocked from Google Search results, keeping your instance private.

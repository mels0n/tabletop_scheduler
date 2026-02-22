# Privacy and Architecture

TabletopTime is designed with a "Privacy-First" philosophy for self-hosted instances, while supporting a sustainable "Hosted" model for the cloud version.

This document explains how we technically ensure that self-hosted (Docker) instances remain free of tracking, ads, and external dependencies.

## The "Hosted" vs "Self-Hosted" Split

The application behaves differently based on the deployment environment. This is controlled primarily by the `NEXT_PUBLIC_IS_HOSTED` environment variable.

| Feature | Self-Hosted / Docker | Hosted (Cloud) |
| :--- | :--- | :--- |
| **Google Analytics** | **Disabled** | Enabled |
| **Robots.txt** | `Disallow: /` (No Crawl) | `Allow: /` |
| **Sitemap** | Hidden | Public |

## Privacy Enforcement

For self-hosted (Docker) instances, privacy is enforced at the component and routing level:
- Components check `NEXT_PUBLIC_IS_HOSTED` at runtime before loading any external scripts or analytics.
- This ensures self-hosted instances never load external tracking scripts.
- The `IS_DOCKER_BUILD=true` flag at build time switches Next.js to `standalone` output mode for containerized deployments.

## SEO and Privacy

### Robots.txt & Meta Tags
For self-hosted (Docker) instances:
-   `app/robots.ts` generates a file disallowing all User Agents (`Disallow: /`).
-   `app/layout.tsx` injects `<meta name="robots" content="noindex, nofollow" />` into every page header via the `metadata.robots` field (controlled by `NEXT_PUBLIC_IS_HOSTED`).

This ensures your private game schedule is explicitly blocked from Google Search results, keeping your instance private.

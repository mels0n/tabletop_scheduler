# Privacy and Architecture

TabletopTime is designed with a "Privacy-First" philosophy for self-hosted instances, while supporting a sustainable "Hosted" model for the cloud version.

This document explains how we technically ensure that self-hosted (Docker) instances remain free of tracking, ads, and external dependencies.

## The "Hosted" vs "Self-Hosted" Split

The application behaves differently based on the deployment environment. This is controlled primarily by the `NEXT_PUBLIC_IS_HOSTED` environment variable.

| Feature | Self-Hosted / Docker | Hosted (Cloud) |
| :--- | :--- | :--- |
| **Third-party analytics** | None | None |
| **Robots.txt** | `Disallow: /` (No Crawl) | `Allow: /` |
| **Sitemap** | Hidden | Public |
| **Database** | SQLite | Postgres (Supabase) |

No version of the app, hosted or self-hosted, loads Google Analytics or any other third-party analytics or advertising script. The hosted flag only changes indexing behavior and the database target.

## Privacy Enforcement

- There is no analytics or tracking code in the repository to enable, so a self-hosted instance never loads external tracking scripts.
- The `IS_DOCKER_BUILD=true` flag at build time switches Next.js to `standalone` output mode for containerized deployments. The Dockerfile also hardcodes `NEXT_PUBLIC_IS_HOSTED=false`.

## Data Retention

Event data is deleted automatically by the cleanup job. These are the defaults, and self-hosters can change them with the `CLEANUP_RETENTION_DAYS_*` variables (see [EnvVariables.md](EnvVariables.md)):

| Data | Deleted |
| :--- | :--- |
| One-shot event (finalized) | 1 day after its finalized slot ends |
| Campaign (finalized) | 1 day after its last scheduled session ends |
| Draft | 1 day after its last proposed slot ends (no slots: 1 day after creation) |
| Cancelled event | 1 day after cancellation |

Deleting an event deletes its participants, votes, slots, and queued webhooks with it.

## SEO and Privacy

### Robots.txt & Meta Tags
For self-hosted (Docker) instances:
-   `app/robots.ts` generates a file disallowing all User Agents (`Disallow: /`).
-   `app/layout.tsx` injects `<meta name="robots" content="noindex, nofollow" />` into every page header via the `metadata.robots` field (controlled by `NEXT_PUBLIC_IS_HOSTED`).

This ensures your private game schedule is explicitly blocked from Google Search results, keeping your instance private.

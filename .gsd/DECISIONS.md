# Architecture Decision Records (ADR)

## ADR-001: Event Privacy & Visibility Strategy

**Date:** 2026-01-20
**Status:** Accepted

### Context
We differentiate between the **Product** (marketing, documentation) and the **User Data** (events).
- **Product** needs maximum visibility (AEO/SEO) to grow.
- **User Data** (Events) is private by default. Users routinely share "Secret Links". Accidental indexing of these links would be a privacy breach.

### Decision
1.  **Architecture Split:**
    - **Public Surface:** Landing Page, Blog, Docs, FAQ. -> **Indexable**.
    - **Private Surface:** `/e/[slug]`, `/manage`, `/api`. -> **NoIndex**.
2.  **Enforcement:**
    - `robots.ts` must implicitly disallow event paths even in explicit allow lists.
    - `EventPage` (`/e/[slug]`) must include `x-robots-tag: noindex` header OR `meta name="robots" content="noindex"` as a defense-in-depth measure, regardless of `robots.txt`.
3.  **Schema:**
    - We will NOT implement `Schema.org/Event` on the event page to avoiding "Rich Snippet" scraping.

### Consequences
- **Positive:** Eliminates risk of user events appearing in search.
- **Positive:** Future audits will ignore "missing event schema" as a feature.
- **Negative:** Users cannot search Google for *their own* event (acceptable trade-off).

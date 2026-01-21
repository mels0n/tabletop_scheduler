# Finding 01: Technical Foundation Audit

## Status: 🟡 Partial Gaps Found

### 1. Sitemap Dynamic Generation
**Finding:** `app/sitemap.ts` includes static routes but excludes `Event` pages.
**Verdict:** ✅ **Working as Intended**.
**Rationale:** User events are private/ephemeral. We intentionally do NOT want them in search indexes. The sitemap correctly reflects the "Public Surface" of the application (Marketing + Content).

### 2. Robots.txt Logic
**Finding:** The logic correctly splits Hosted vs Self-Hosted.
**Observation:** It lacks explicit `Allow` directives for AI User Agents on the *Hosted* version.
**Fix Required:** Add explicit `Allow` directives for `GPTBot`, `ClaudeBot` to the Hosted branch to ensure they crawl our *Marketing* pages (Blog, FAQ, Landing).

### 3. Metadata Templates
**Finding:** `layout.tsx` has a basic template.
**Gap:** It lacks PWA-related tags (`application-name`, etc.).
**Fix Required:** Enhance the metadata object to be "PWA-ready".

### 4. Content-Type Header
**Finding:** Next.js `sitemap.ts` usually handles this, but verification is needed in production.

## Action Plan
- [ ] Update `robots.ts` to include AEO Allowlist (for Marketing pages only).
- [ ] Enrich `layout.tsx` metadata.

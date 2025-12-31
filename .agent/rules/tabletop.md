---
trigger: always_on
---

## Project-Specific Overrides 

### A. The "Privacy vs. Visibility" Split (CRITICAL)
**Global AEO/SEO/GEO rules apply CONDITIONALLY based on deployment mode:**

1. **HOSTED Mode (`NEXT_PUBLIC_IS_HOSTED=true`):**
   - **Mandate:** Full AEO/SEO/GEO. Apply all Schema.org, Sitemap, and Metadata rules from `/.GEMINI.md`.
   - **Goal:** Maximize discoverability and public indexing.

2. **SELF-HOSTED Mode (`IS_DOCKER_BUILD=true`):**
   - **Mandate:** Privacy First. **OVERRIDE** global AEO/SEO/GEO rules regarding indexing.
   - **Enforcement:**
     - **Robots:** `robots.txt` must be `Disallow: /`.
     - **Meta:** `layout.tsx` must inject `<meta name="robots" content="noindex, nofollow" />`.
     - **NoOp Pattern:** Ensure `GoogleAnalytics` and `AdSense` are aliased to `null` (NoOp) in `next.config.mjs`. Never import these directly without build-time checks.

### B. The "Dual-Bot" Consistency Rule
- **Logic Sync:** Any change to Telegram bot command logic must be applied to **BOTH**:
  - `app/api/telegram/webhook/route.ts` (Production/Webhook)
  - `lib/telegram-poller.ts` (Dev/Long-Polling)
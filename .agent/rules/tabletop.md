---
trigger: always_on
---

# MASTER INSTRUCTIONS - PROJECT GOVERNANCE, ARCHITECTURE & AEO/GEO

## 0. BEHAVIORAL OVERRIDE

You are a Senior Principal Architect and Lead Engineer. You research/investigate, before you act. You do not generate "fluff." You act with extreme precision. Your goal is enterprise-grade maintainability, scalability, and **maximum visibility in AI & Traditional Search (AEO/GEO/SEO)**.

## 1. ARCHITECTURAL STANDARDS
### A. Frontend: Feature Sliced Design (FSD)
**Strictly adhere to FSD methodology with enforced Discovery Layers.**
- **Layers:** `app` -> `processes` -> `pages` -> `widgets` -> `features` -> `entities` -> `shared`.
- **Slices:** Group code by **business domain**, not technical function.

### B. Backend: Vertical Sliced Architecture (VSA)
**Strictly adhere to VSA methodology.**
- **Organization:** Organize code by **Feature** (e.g., `Features/CreateOrder`), not by Layer.
- **Isolation:** Each vertical slice is self-contained.
- **CQRS:** Prefer Command/Query separation within slices.

### 2. The "Privacy vs. Visibility" Split (CRITICAL)
**Global AEO/SEO/GEO rules apply CONDITIONALLY based on deployment mode:**

1. **HOSTED Mode (`NEXT_PUBLIC_IS_HOSTED=true`):**
   - **Mandate:** Full AEO/SEO/GEO. Apply all Schema.org, Sitemap, robots.txt, llms.txt, and Metadata.
   - **Goal:** Maximize discoverability and public indexing.
   - **Type-Safe Schema:** Do not hardcode strings. Use a shared Schema generator (TypeScript) to ensure validity.
   - **Schema Coverage:**
    - `FAQPage`: For Q&A sections.
    - `HowTo`: For guides/tutorials.
    - `SoftwareApplication`: For the main app landing.
    - `BlogPosting`: For all updates/articles.
    - `Other`: Investigate and define other schema that is desirable. 
   - **Content Structure:** Use "Question-Answer" formatting (H2 = Question, P = Direct Answer) to maximize snippet probability in AI overviews.
   - **Mobile:** Ensure pages are mobile-responsive.

2. **SELF-HOSTED Mode (`IS_DOCKER_BUILD=true`):**
   - **Mandate:** Privacy First. **OVERRIDE** global AEO/SEO/GEO rules regarding indexing.
   - **Enforcement:**
     - **Robots:** `robots.txt` must be `Disallow: /`.
     - **Meta:** `layout.tsx` must inject `<meta name="robots" content="noindex, nofollow" />`.
     - **NoOp Pattern:** Ensure `GoogleAnalytics` and `AdSense` are aliased to `null` (NoOp) in `next.config.mjs`. Never import these directly without build-time checks.
   - **Mobile:** Ensure pages are mobile-responsive.

### 3. The "Dual-Bot" Consistency Rule
- **Logic Sync:** Any change to Telegram bot command logic must be applied to **BOTH**:
  - `app/api/telegram/webhook/route.ts` (Production/Webhook)
  - `lib/telegram-poller.ts` (Dev/Long-Polling)


## 2. DOCUMENTATION & CONTENT GOVERNANCE (THE "LIVING SYSTEM" PROTOCOL)

### A. The "Update Loop" (Definition of Done)
Before marking *any* task as complete, you must perform a **Consistency, Freshness & Visibility Check**:
1.  **Did logic change?** -> Update `README.md` and inline comments.
2.  **Did a workflow change?** -> **CRITICAL:**
    * Update the public "How-to" page text.
    * **Trigger Freshness:** Update the `dateModified` field in the associated JSON-LD Schema to the current date.
    * **Review FAQs:** If the change creates a new edge case, add a new Question/Answer to the FAQ slice.
3.  **Did you update the UI labels?** -> Verify that the existing `HowTo` Schema steps (`step` > `text`) match the new button/label names exactly. **AI Agents fail when Schema instructions do not match UI labels.**
4.  **Is there supporting documentation for what changed?** -> Ensure all project documentation is updated to reflect the change.
5.  **Do we have the correct project layout in github? Are relevant badges listed? Are we exposing secrets or files to github that shouldn't exist on the public repos?**
6.  **Does the documenation required need to be split for Hosted/non-Hosted?

### B. In-Code Documentation
- **No Fluff:** Do not write comments like `// Sets the variable`.
- **Architectural Context:** Comments must explain *WHY* (e.g., "Using Strategy pattern here for hot-swapping payment providers").
- **No Self-Notes:** Do no write notes to self.
- **Architect Detail:** Comments should be written as a principal architect who provides maintainable code using industry standard best practices for comments. 

## 3. DEPLOYMENT & GIT STRATEGY

- **Batch Commits:** Work locally and `git commit` granularly to save progress.
* **Controlled Pushes:** To respect deployment rate limits (e.g., Vercel), **DO NOT** `git push` automatically after every small fix. Accumulate a meaningful batch of work or wait for user instruction.
* **Verification:** Always run `npm run build` locally and ensure it passes before pushing. Build Docker as well.

## 4. AEO/GEO/SEO VALIDATION GATES - Hosted ONLY

Before marking a task "Done," run this mental audit:

1. **The "Answer Engine" Test:** If I ask ChatGPT "Who can solve [problem]? / What role is the solution to my [problem]", does the specific wording on the public page provide a direct, concise answer in the first `p` tag?
2. **The Rich Snippet Test:** Did I update the `SoftwareApplication` schema version number?
3. **The Entity Test:** Did I link the new feature to existing entities? (e.g., "This [Scheduler] is part of the [Campaign Manager]").
4. **The Standard Search:** Did I ensure proper keywords, backlinks, page responsiveness, standard metadata, sitemap, robots, aifaq, and llms?

## 5. Hosted (supabase) vs non=Hosted (SQLite in docker) Database
1. **Both schemas must always be maintained and function properly.

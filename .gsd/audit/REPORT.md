# GEO/SEO Audit Report: v1.4 (Revised)

## Executive Summary
**Current AI Visibility Score:** **65/100 (B-)**

*Correction: The "Invisible Product" (Events) is a feature, not a bug. The score is higher because the privacy architecture is functioning correctly.*

The primary goal of AEO/SEO is to market the **Tool itself**, not the user's data. We need to ensure that when someone asks "What is the best D&D Scheduler?", Tabletop Time appears as the *answer*—but their actual game night details remain hidden.

## Key Findings

### 1. Privacy Architecture (Technical) ✅
The `sitemap.xml` correctly excludes user events. This is excellent.
- **Action:** Maintain this exclusion. Ensure `robots.txt` allows crawlers to see the *Landing Page* and *Blog* so they know the tool exists.

### 2. Product Identity (Schema) 🟡
The `SoftwareApplication` schema exists but is brittle (hardcoded string).
- **Fix:** Refactor `layout.tsx` to use a type-safe generator. This ensures we don't break our own rich results with a typo.

### 3. Content Strategy (AEO) 🟡
The `ai-faq` is strong. The Landing Page needs better "Question-Answer" formatting to be picked up by AI summaries.
- **Fix:** Add specific entity-dense Q&A sections to `page.tsx` or a dedicated `features` page.

### 4. Code Quality
- **Recommendations:** Standardize Schema generation. Add AEO-friendly `llms.txt` to guide agents to the *Documentation* and *About* pages.

## Recommendations & Roadmap

### Phase 2: Technical Foundation (Marketing Focus)
1.  **Robots.txt:** Explicitly welcome `GPTBot`/`ClaudeBot` to *public* routes only.
2.  **Metadata:** Polish the PWA/App Store metadata on the layout.
3.  **LLM.txt:** Create the "AI Sitemap" pointing to Blog/Guides.

### Phase 3: Semantic Enrichment
1.  **Refactor:** Type-safe Schema Generator.
2.  **Breadcrumbs:** Better structure for /guide sections.
3.  **Content:** Enhance Landing Page copy with "Voice of the Customer" questions.

## Conclusion
The machine is working correctly. We just need to polish the chrome so the world knows it exists.

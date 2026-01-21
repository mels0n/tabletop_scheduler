---
projectId: tabletop_scheduler
status: FINALIZED
version: 1.4.0
lastUpdated: 2026-01-20
---

# Specification: GEO/SEO/AEO Visibility

## 1. Goal
Audit and optimize the application for visibility in both traditional Search Engines (SEO) and Generative Engines (GEO/AEO). The goal is to maximize the "AI Visibility Score" by ensuring content is machine-parsable, semantically rich, and structured for answer retrieval.

## 2. Success Criteria
- [ ] **Audit Completed**: A comprehensive report of current SEO/GEO gaps.
- [ ] **Semantic Coverage**: Key entities (Event, Scheduler, Guide) have JSON-LD Schema.
- [ ] **Technical Foundation**:
    - [ ] `sitemap.xml` is valid and indexed.
    - [ ] `robots.txt` is correct for Hosted vs Self-Hosted.
    - [ ] `llms.txt` exists and follows protocols.
    - [ ] Metadata (Title/Desc) is distinct for every page.
- [ ] **Content Structure**: Public pages follow Q&A format for AEO snippets.

## 3. Core Requirements
- **LLM Optimization**: Create `llms.txt` and `ai.txt` for crawler guidance.
- **Schema.org**: Implement strict, validated JSON-LD for all public pages.
- **Hosted vs Self-Hosted**: Ensure privacy rules (no-index) strictly apply to self-hosted builds, while hosted builds are maximally visible.
- **Crawlability**: Ensure dynamic routes (`/e/[slug]`) are discoverable.

---
phase: 1
level: 2
researched_at: 2026-01-20
---

# Phase 1 Research: GEO/AEO Standards

## Questions Investigated
1. What is the standard for `llms.txt`?
2. How should `robots.txt` be configured for AEO vs Privacy?
3. What Schema properties matter for a Web App in 2026?
4. What keywords/entities define the domain?

## Findings

### llms.txt Standard
A markdown file at the root proposing a standard for LLM crawlers.
- **Structure**: H1 (Project Name) -> Blockquote (Summary) -> H2 (Sections) -> Links.
- **Purpose**: "Sitemap for AI" - providing a clean, token-efficient map of the site.
- **Recommendation**: Implement `public/llms.txt` mirroring the sitemap but with context.

### Robots.txt for AEO
To maximize **Answer Engine Optimization (AEO)**, we must explicitly allow AI User Agents often blocked by default privacy lists.
- **Good Bots (Allow)**: `GPTBot`, `ClaudeBot`, `Google-Extended` (for Search Generative Experience).
- **Privacy (Disallow)**: In "Self-Hosted" mode, we must block *everything* (`Disallow: /`).
- **Strategy**: Dynamic `robots.ts` generation based on `IS_DOCKER_BUILD`.

### Schema.org: SoftwareApplication
For a Web App, the `SoftwareApplication` -> `WebApplication` schema is critical.
- **Key Properties**: `name`, `applicationCategory`, `operatingSystem` ("Web"), `offers` (pricing), `aggregateRating`.
- **Gap**: We currently have no schema. We need a strictly typed generator.

### Keywords & Entities
AEO relies on **Entity Density**.
- **Core Entities**: "TTRPG", "D&D", "Scheduler", "Game Master", "Availability", "Time Zone".
- **Vocabulary**: Content must use these terms explicitly in Q&A format (H2 Question -> Paragraph Answer).

## Decisions Made
| Decision | Choice | Rationale |
|----------|--------|-----------|
| **LLM File** | Implement `llms.txt` | Emerging standard for AI discoverability. |
| **Robots Strategy** | Dynamic Allowlist | Maximize visibility for Hosted, privacy for Docker. |
| **Schema Strategy** | `WebApplication` | Best fit for Google Rich Results. |

## Ready for Planning
- [x] Questions answered
- [x] Approach selected
- [x] Dependencies identified (Schema types)

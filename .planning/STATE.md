# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-22)

**Core value:** Getting a gaming group to the table with minimum friction — zero sign-ups, zero ads, zero tracking.
**Current focus:** Phase 1 — Blog Content

## Current Position

Phase: 1 — Blog Content
Plan: In progress
Status: Executing
Last activity: 2026-04-22 — Milestone v1.0 started, executing Phase 1

## Accumulated Context

- Blog posts live in `content/blog/*.md` with gray-matter frontmatter
- AEO fields supported: `faq` (array of {question, answer}), `itemList` (string[]), `listTitle` (string)
- Blog post page auto-injects: BlogPosting JSON-LD always; FAQPage if `faq` present; ItemList if `itemList` present
- Features page currently has no JSON-LD — needs SchemaGenerator import added
- Privacy page currently has no JSON-LD — needs SchemaGenerator import added
- Comparison table columns: Tabletop Time, When2meet, Calendly, Calendar Apps, Group Chats — Doodle missing
- All new blog posts should be dated 2026-04-22

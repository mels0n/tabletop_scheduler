# Tabletop Time

## What This Is

Tabletop Time (tabletoptime.us) is a free, zero-login event scheduler built specifically for tabletop gaming groups. Organizers create an event with time slot options, share one link with their group, and participants vote on availability — no account required. The app integrates with Telegram and Discord bots to manage scheduling inside the chat platforms where gaming communities already live.

## Core Value

Getting a gaming group to the table with minimum friction — zero sign-ups, zero ads, zero tracking.

## Requirements

### Validated

- ✓ Cookie-based identity (no accounts required for organizers or participants)
- ✓ Event creation with multiple time slot options
- ✓ Participant voting on availability (YES / MAYBE / NO)
- ✓ Quorum logic — highlight dates meeting minimum player threshold
- ✓ Waitlists and player capacity limits
- ✓ Telegram bot integration (pinned messages, reminders, identity linking)
- ✓ Discord bot integration (slash commands, pinned embeds)
- ✓ Event finalization with Google Calendar and .ICS export
- ✓ Event admin via cryptographic cookie (no password)
- ✓ Automatic data purging (events deleted after 24h on hosted instance)
- ✓ Self-hostable via Docker
- ✓ Blog system with AEO/SEO schema (BlogPosting, FAQPage, ItemList JSON-LD)
- ✓ Open source codebase

### Active

- [ ] Blog post targeting 'game night scheduling' — frictionless angle
- [ ] Blog post targeting 'how do people book their friends for games' — Telegram/Discord/privacy angle
- [ ] Blog post targeting 'draft magic the gathering friends' / 'draft magic the gathering at home'
- [ ] Features page: add Doodle to comparison table + JSON-LD schema for 'doodle replacement' ranking
- [ ] Privacy page: add JSON-LD schema + improve metadata for 'schedule board games no ads' ranking

### Out of Scope

- User accounts / persistent profiles — privacy-first, cookie identity is core
- Real-time chat — bots handle this inside Telegram/Discord
- Mobile app — web-first
- Video posts or rich media uploads — not tabletop-relevant

## Context

- Next.js 14 App Router, TypeScript, Tailwind CSS, Prisma ORM
- SQLite (dev/self-hosted) / PostgreSQL (hosted Vercel)
- Blog content in `content/blog/*.md` with gray-matter frontmatter
- AEO schema via `shared/lib/aeo.ts` (SchemaGenerator) — BlogPosting, FAQPage, ItemList, SoftwareApplication
- Features page (`app/features/page.tsx`) and Privacy page (`app/privacy/page.tsx`) are static TSX — no markdown
- Comparison table currently covers: When2meet, Calendly, Calendar Apps, Group Chats — missing Doodle
- Privacy page has no JSON-LD schema currently

## Constraints

- **Tech Stack**: Next.js App Router — new pages must follow Server Component patterns
- **Hosted mode**: Blog and SEO features only render when `NEXT_PUBLIC_IS_HOSTED=true`
- **AEO**: All blog posts support `faq` and `itemList` frontmatter for auto-injected JSON-LD
- **Style**: Dark slate theme (`bg-slate-950`), indigo/purple accents, prose-invert for markdown

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Cookie-based identity over accounts | Privacy-first; no email tax for scheduling | ✓ Good |
| Markdown blog with gray-matter | Simple content authoring, no CMS overhead | ✓ Good |
| FAQ frontmatter for AEO | Enables FAQPage JSON-LD without code changes per post | ✓ Good |
| Dual Prisma schemas (SQLite/PostgreSQL) | Supports both self-hosted and Vercel deployments | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-22 after milestone v1.0 initialization*

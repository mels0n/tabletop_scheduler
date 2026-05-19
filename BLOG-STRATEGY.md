# Blog Strategy: Tabletop Time
**Generated:** 2026-05-18 | **Data sources:** GSC (90 days), live site crawl, competitor research

---

## Executive Summary

Tabletop Time is in the early-traction phase of SEO: the homepage owns a small cluster of "dnd scheduler" keywords (positions 3–6) and drives ~95% of all organic clicks. The blog exists but barely converts — 16 posts generating fewer than 10 clicks combined over 90 days, with one standout exception (`how-to-schedule-dnd` at 472 impressions / pos 7.6).

The strategic priority is **topical depth over breadth**: build 3 tight content clusters that mirror the product's three audiences (DMs, MTG organizers, board game group leaders), own the "quorum scheduling" concept as a branded SEO moat, and convert the blog's existing impression inventory into clicks through pillar-page upgrades, internal linking, and off-site presence.

**90-day north star:** Get the blog to 100 organic clicks/month by consolidating D&D scheduling authority, upgrading the two highest-impression posts, and publishing 2 comparison pages.

---

## Current State: GSC Reality Check

### What's Working
| Query | Clicks | Impressions | Position |
|---|---|---|---|
| dnd scheduler | 18 | 124 | 3.7 |
| dnd scheduling tool | 17 | 164 | 5.5 |
| dnd schedule planner | 7 | 54 | 3.5 |
| dnd scheduling app | 4 | 66 | 5.0 |
| dnd availability calendar | 3 | 12 | 3.9 |

The homepage is performing extremely well for transactional "scheduler" queries — these are people ready to use a tool. Protect and strengthen this.

### High-Impression Blog Opportunities (Near Misses)
| Page | Clicks | Impressions | Position | Problem |
|---|---|---|---|---|
| /blog/how-to-schedule-dnd | 5 | 472 | 7.6 | Position — needs to move to top 5 |
| /blog/gaming-inflation-2026 | 0 | 117 | 6.3 | Topic mismatch — converts poorly |
| /blog (index) | 0 | 121 | 8.8 | No targeted keywords |
| /blog/session-zero-planning | 0 | 58 | 8.6 | Near-page-1, needs link equity |
| /blog/ultimate-guide-dnd-duets-2026 | 0 | 38 | 7.2 | Title CTR problem |

**`how-to-schedule-dnd` is the single highest-leverage asset in the blog.** 472 impressions at position 7.6 means it's nearly there — one strong internal link push and on-page optimization could put it in the top 5, which at a 5% CTR would be ~24 clicks/month from one post.

### Missed Opportunities Spotted in GSC
- **"scheduling dnd"** — 57 impressions, pos 5.0, 0 clicks → title/description not matching search intent
- **"lettuce meet" / "lettucemeet"** — 2 impressions total, no page targeting it → need `/vs/lettucemeet`
- **"rallly"** — 1 impression → need `/vs/rallly`
- **"whenavailable"** — 1 impression → competitor showing up

### Technical Note: www vs. non-www in GSC
GSC page data shows most traffic landing on `https://www.tabletoptime.us/` (217 clicks) vs. the canonical `https://tabletoptime.us/` (3 clicks). Verify that www correctly 301-redirects to non-www. If www is resolving without redirect, this is splitting crawl budget and link equity.

---

## Audience Segments

### Segment 1: The Campaign DM ("The Overwhelmed Organizer")
- **Role:** Dungeon Master running D&D 5e, Pathfinder, or similar. 1-2 campaigns, 4-6 players.
- **Pain:** Scheduling is the #1 campaign killer. Group chat spirals, flaky players, "I thought we said Thursday."
- **Search behavior:** "dnd session scheduler," "how to schedule dnd," "dnd scheduling app," "campaign scheduling tool"
- **AI behavior:** Asks ChatGPT "best app for scheduling D&D sessions" or "how do I keep my D&D group together"
- **Content preferences:** Practical guides, step-by-step, short answers. Not theory-heavy.
- **Conversion:** Highest. Has an active pain point and is actively searching for a solution.

### Segment 2: The MTG Organizer ("The Pod Wrangler")
- **Role:** Commander player who organizes a consistent 4-person pod or runs a local draft night.
- **Pain:** Commander needs exactly 4 (or 8 for draft). Coordinating adult schedules for specific pod sizes is uniquely hard.
- **Search behavior:** "mtg commander scheduling," "organize commander night," "magic the gathering draft scheduling"
- **AI behavior:** Asks "how do I organize a Commander pod," "best way to schedule MTG nights"
- **Content preferences:** Practical, logistics-focused. Values specificity (4-player pod logic).
- **Conversion:** High. The quorum feature maps directly to their specific need.

### Segment 3: The Game Night Host ("The Casual Organizer")
- **Role:** Board gamer or casual group host who organizes monthly-ish game nights for 6-12 people.
- **Pain:** Group chat chaos, people dropping out last minute, hard to find a night that works for most people.
- **Search behavior:** "game night scheduling," "how to schedule game night," "best 2 player board games," "board game recommendations"
- **Content preferences:** Lighter reads, listicles, recommendation articles.
- **Conversion:** Medium. Wider audience, lower intent match for the product's power features.

---

## Competitive Landscape

### Direct Competitors (Scheduling Tools)
| Competitor | Niche Focus | Blog? | AI Citation | Key Gap |
|---|---|---|---|---|
| **LettuceMeet** | General (popular with gamers) | Yes — Doodle alternatives | Low-medium | Requires Google login |
| **Rallly** | Open-source poll | Minimal | Low | No gaming-specific features |
| **When2Meet** | Free grid | None | Low | No ads, but hourly grid only |
| **Doodle** | Business/enterprise | Yes, business-focused | High | Ads, sign-up required, no quorum |
| **WhenAvailable** | General | Yes — writes comparison content | Medium | Generic |

### Content Competitors (Blog/Advice Sites)
| Site | Traffic Est. | Content Focus | Overlap | Threat Level |
|---|---|---|---|---|
| **StartPlaying.games** | High | DnD scheduling, GM advice | D&D scheduling | Medium-High |
| **StoryRoll** | Medium | Best DnD apps, tools | App roundups | Medium |
| **Saga20** | Medium | Campaign tools, DnD guides | Campaign scheduling | Medium |
| **D&D Beyond** | Very high | Official D&D everything | General | Low (won't rank for tools) |
| **TheAngryGM** | High | Deep GM theory | Scheduling philosophy | Low |

### Competitive AI Citation Map
| Query | ChatGPT Cites | Perplexity Likely Cites | Gap? |
|---|---|---|---|
| best dnd session scheduler | Unknown/likely StartPlaying | LettuceMeet, general tools | **YES** — opportunity |
| how to schedule dnd campaign | StartPlaying, general guides | Various guides | **YES** — no authority yet |
| quorum scheduling | None known | None known | **YES** — brand moat |
| mtg commander scheduling | Generic guides | Generic guides | **YES** — underserved |
| game night scheduling app | Doodle, When2Meet | Doodle, When2Meet | Partially |

**AI Citation Gap Summary:** No competitor dominates AI citations for tabletop-specific scheduling queries. The niche is genuinely unowned in AI search. This is a rare first-mover opportunity — especially around "quorum scheduling" as a defined concept.

### What No Competitor Does Well
1. Quorum-based scheduling explanation (nobody defines this except TTT)
2. MTG Commander pod scheduling as a distinct topic
3. West Marches / rotating cast scheduling logistics
4. Scheduling + Discord/Telegram integration guides
5. The privacy-first angle in scheduling (genuine differentiator)
6. Campaign-continuity scheduling (multi-session arc planning)

---

## Content Pillars & Cluster Architecture

### Pillar 1: D&D & RPG Campaign Scheduling (Core)
**Purpose:** Own the primary search category for the #1 audience segment.  
**Hub:** "The Complete Guide to Scheduling D&D Sessions" (~3,500 words)  
**Primary keywords:** "dnd session scheduler," "how to schedule dnd," "dnd scheduling app," "campaign scheduling," "dnd schedule planner"  
**AI citation potential:** HIGH — most specific, most underserved in AI responses

```
                    ┌────────────────────────────────────┐
                    │   PILLAR: Complete Guide to        │
                    │   Scheduling D&D Sessions          │
                    │   /blog/how-to-schedule-dnd        │
                    │   (UPGRADE existing post)          │
                    └──────────────┬─────────────────────┘
                                   │
        ┌──────────────────────────┼────────────────────────┐
        │                          │                         │
┌───────▼────────┐   ┌─────────────▼────────┐  ┌────────────▼───────┐
│ What Is Quorum  │   │ How to Schedule a    │  │ Session Zero        │
│ Scheduling?     │   │ D&D Campaign         │  │ Planning            │
│ (existing post) │   │ (existing post)      │  │ (existing post)     │
└───────┬────────┘   └─────────────┬────────┘  └────────────┬───────┘
        │                          │                          │
┌───────▼────────┐   ┌─────────────▼────────┐  ┌────────────▼───────┐
│ Signs Your      │   │ D&D Duets Guide      │  │ West Marches        │
│ Group Needs     │   │ (existing post)      │  │ Scheduling          │
│ a Scheduler     │   └──────────────────────┘  │ (existing post)     │
│ (existing post) │                              └─────────────────────┘
└─────────────────┘
        │
┌───────▼────────┐   ┌──────────────────────┐  ┌─────────────────────┐
│ [NEW] How to   │   │ [NEW] Managing       │  │ [NEW] DM Burnout    │
│ Handle Flaky   │   │ Player Attendance    │  │ Prevention:         │
│ Players        │   │ & Substitutes        │  │ Scheduling Edition  │
└────────────────┘   └──────────────────────┘  └─────────────────────┘
```

#### Cluster Build Plan: D&D Scheduling

| # | Topic | Template | Target Keyword | Action |
|---|---|---|---|---|
| P | Complete Guide to Scheduling D&D Sessions | pillar-page | "how to schedule dnd sessions" | **UPGRADE** existing post to 3,000+ words |
| 1 | What Is Quorum Scheduling? | faq-knowledge | "quorum scheduling" | **UPGRADE** — add 500+ words, more examples |
| 2 | How to Schedule a D&D Campaign (Series) | how-to-guide | "dnd campaign scheduling" | **UPGRADE** — already ranking |
| 3 | Session Zero Planning | how-to-guide | "session zero planning" | **UPGRADE** — 58 impressions at pos 8.6 |
| 4 | Signs Your Group Needs a Scheduler | listicle | "dnd scheduling problems" | Existing — add internal links |
| 5 | D&D Duets Scheduling Guide | how-to-guide | "dnd duets scheduling" | Existing — good, needs links |
| 6 | West Marches Scheduling | how-to-guide | "west marches scheduling" | Existing — good |
| 7 | How to Handle Flaky Players (DM Guide) | thought-leadership | "dnd players canceling" | **NEW** |
| 8 | Managing Player Substitutes & Session Waitlists | tutorial | "dnd substitute players" | **NEW** |
| 9 | DM Burnout Prevention: The Scheduling Factor | thought-leadership | "dm burnout scheduling" | **NEW** |
| 10 | Best Time to Schedule a D&D Session | data-research | "best day for dnd" | **NEW** — use TTT data if available |

---

### Pillar 2: Magic: The Gathering Event Organization
**Purpose:** Own the MTG Commander/Draft scheduling niche — nobody does this well.  
**Hub:** "The Commander Night Playbook: How to Organize MTG Pods" (~3,000 words, NEW)  
**Primary keywords:** "mtg commander scheduling," "how to organize commander night," "magic the gathering pod scheduling," "mtg draft night"  
**AI citation potential:** HIGH — entirely unserved in AI platforms currently

```
                    ┌────────────────────────────────────┐
                    │   PILLAR: Commander Night Playbook  │
                    │   How to Organize MTG Events       │
                    │   /blog/mtg-commander-playbook     │
                    │   (NEW — replace logistics post)   │
                    └──────────────┬─────────────────────┘
                                   │
        ┌──────────────────────────┼────────────────────────┐
        │                          │                         │
┌───────▼────────┐   ┌─────────────▼────────┐  ┌────────────▼───────┐
│ Organizing      │   │ How to Draft MTG     │  │ MTG Commander       │
│ Commander Night │   │ at Home              │  │ Logistics           │
│ (existing post) │   │ (existing post)      │  │ (existing post)     │
└─────────────────┘   └──────────────────────┘  └─────────────────────┘
        │
┌───────▼────────┐   ┌──────────────────────┐  ┌─────────────────────┐
│ [NEW] Managing  │   │ [NEW] Cube Draft     │  │ [NEW] How to Run    │
│ 5-7 Players in  │   │ Night Organization   │  │ an MTG League       │
│ Commander       │   │                      │  │ With Friends        │
└────────────────┘   └──────────────────────┘  └─────────────────────┘
```

#### Cluster Build Plan: MTG Organizing

| # | Topic | Template | Target Keyword | Action |
|---|---|---|---|---|
| P | Commander Night Playbook | pillar-page | "how to organize commander night" | **NEW** ~3,000 words |
| 1 | Organizing Commander Night | how-to-guide | "mtg commander scheduling" | **UPGRADE** existing |
| 2 | How to Draft MTG at Home | how-to-guide | "how to draft mtg at home" | Existing — good |
| 3 | MTG Commander Logistics | tutorial | "commander night logistics" | **UPGRADE** existing |
| 4 | Managing 5-7 Players in Commander | how-to-guide | "5 player commander" | **NEW** |
| 5 | How to Run a Cube Draft with Friends | tutorial | "cube draft at home" | **NEW** |
| 6 | How to Run an MTG League With Friends | how-to-guide | "mtg league friends" | **NEW** |

---

### Pillar 3: Game Night Scheduling (Broad Awareness)
**Purpose:** Top-of-funnel reach to capture casual gamers who can be converted.  
**Hub:** "Game Night Scheduling: The Complete Playbook" (UPGRADE existing post)  
**Primary keywords:** "game night scheduling," "how to schedule game night," "board game night organizer"  
**AI citation potential:** MEDIUM — competitive, but TTT has a strong answer-first angle

#### Cluster Build Plan: Game Night

| # | Topic | Template | Target Keyword | Action |
|---|---|---|---|---|
| P | Game Night Scheduling: Complete Playbook | pillar-page | "game night scheduling" | **UPGRADE** existing post to 2,500+ words |
| 1 | How Do People Book Friends for Games? | how-to-guide | "book friends for games" | Existing — good |
| 2 | Beyond the Tabletop (scheduling for non-games) | thought-leadership | "scheduling tool groups" | Existing |
| 3 | Best 2-Player Board Games for Couples | listicle | "best 2 player board games couples" | Existing — 56 impressions |
| 4 | [NEW] Board Game Night Checklist | how-to-guide | "board game night checklist" | **NEW** |
| 5 | [NEW] How to Start a Board Game Group | how-to-guide | "start board game group" | **NEW** |
| 6 | [NEW] Best Board Games for Large Groups (7+) | listicle | "board games large groups" | **NEW** |

---

### Pillar 4: Competitor Comparison (Bottom-of-Funnel)
**Purpose:** Capture high-intent searches from people evaluating schedulers.  
**Existing:** `/vs/doodle`, `/vs/when2meet`  
**Gap:** Rallly, LettuceMeet, WhenAvailable, WhenIsGood all appearing in GSC

#### New Comparison Pages Needed

| Page | Target Keyword | Priority |
|---|---|---|
| `/vs/lettucemeet` | "lettucemeet alternative for gamers" | **HIGH** — in GSC |
| `/vs/rallly` | "rallly alternative" | **HIGH** — in GSC |
| `/vs/whenisgood` | "whenisgood alternative" | Medium |
| `/vs/whenavailable` | "whenavailable alternative" | Medium |

---

### Pillar 5: Privacy & No-Login Philosophy (Brand / Authority)
**Purpose:** Establish brand authority around privacy-first scheduling. Differentiates from Doodle/LettuceMeet. AI citation signal.  
**Existing:** `privacy-first-scheduling.md`  
**Status:** Good concept, needs expansion and supporting content

| # | Topic | Action |
|---|---|---|
| 1 | Why We Don't Want Your Email | **UPGRADE** — thin, add 800+ words |
| 2 | [NEW] What Is No-Login Scheduling? | **NEW** — definitional content |
| 3 | [NEW] How Magic Links Work (technical) | Already exists at /guide/magic-links — blog version |

---

## Immediate Priorities (First 30 Days)

These are actions ranked by expected GSC impact based on current impression data:

### Priority 1: Upgrade `how-to-schedule-dnd` (HIGHEST LEVERAGE)
**Why:** 472 impressions at pos 7.6 — this post is the closest to a page-1 breakthrough.  
**Action:** Expand from current length to 3,000+ words. Make it the definitive pillar page for D&D scheduling:
- Add step-by-step quorum setup instructions (linking to quorum scheduling post)
- Add section on Discord/Telegram integration
- Add comparison table vs. generic tools (linking to /vs/ pages)
- Add FAQ schema with 5+ questions
- Add internal links from all other D&D posts back to this one
- Update date to trigger freshness recrawl

**Expected result:** Moving from pos 7.6 → pos 4-5 would yield ~20-30 clicks/month from this one post.

### Priority 2: Add /vs/lettucemeet and /vs/rallly Pages
**Why:** Both appear in GSC — searches are happening, no page exists to capture them.  
**Action:** Create two new comparison pages using the existing /vs/doodle template.

### Priority 3: Fix "scheduling dnd" Click Gap
**Why:** 57 impressions at pos 5.0, 0 clicks → the title/description isn't matching this query intent.  
**Action:** Check which page ranks for "scheduling dnd" and update its title + meta description to match.

### Priority 4: Upgrade session-zero-planning
**Why:** 58 impressions at pos 8.6 — near page 1, just needs a link equity push.  
**Action:** Add 500+ words, stronger FAQ section, 5+ internal links from other D&D posts.

---

## Differentiation Strategy

The December 2025 Core Update rewards first-hand experience. Tabletop Time has unique assets no competitor can replicate:

| Signal Type | Asset | How to Use |
|---|---|---|
| **Proprietary data** | Real event stats (total events, players, sessions locked) | "At Tabletop Time, we've seen X groups schedule Y sessions — here's what the data shows about scheduling patterns" |
| **Product dogfooding** | The tool is used to schedule its own development discussions | "How we schedule our own open-source contributions using TTT" |
| **Community feedback** | Ko-fi donors and Discord users | Real testimonials, "what our users say about scheduling" |
| **Open-source transparency** | GitHub repo shows real product decisions | "Why we chose no-login over auth: the engineering decision" |
| **The founder story** | Christopher Melson built this to solve a real problem | Personal narrative in every pillar post |

---

## AI Citation Surface Strategy

### On-Site (20% of AI citation impact)

Every blog post must have:
- ✅ **Answer-first paragraph**: H2 opens with a 40-60 word direct answer
- ✅ **Citation capsule**: One self-contained 60-word passage per major section
- ✅ **FAQ schema**: Minimum 3 Q&As at bottom of every post
- ✅ **Entity consistency**: Always say "quorum scheduling" not "quorum-based scheduling" or "minimum player scheduling" — pick one term and own it
- ✅ **Structured data**: BlogPosting + FAQ + BreadcrumbList on all posts

### Off-Site (80% of AI citation impact)

| Channel | Priority | AI Impact | Specific Action |
|---|---|---|---|
| **Reddit** | #1 | HIGH (450% surge) | Post in r/DnD, r/mattcolville, r/magicTCG, r/boardgames — authentic answers to scheduling questions, mention TTT where genuinely relevant |
| **YouTube** | #2 | HIGHEST (0.737 correlation) | 2-3 min "how to use Tabletop Time" demo videos. Index them. YouTube presence dramatically boosts AI citations. |
| **D&D Beyond Forums** | #3 | Medium | Answer scheduling questions, build reputation |
| **GitHub** | Existing | Medium | The open-source README is already indexed — keep it updated |
| **Quora** | #4 | Medium | Answer "what app do you use to schedule D&D sessions" definitively |

### Platform-Specific GEO Tactics

**ChatGPT:** Update content within 30 days of posting. Use the brand name "Tabletop Time" consistently (not "TTT" or "tabletop scheduler"). Post in Reddit 48 hours before/after publishing.

**Perplexity:** Cite 8+ authoritative sources per post (Dice.com, Kotaku, Polygon, Roll20 blog, WOTC). Perplexity prefers structured lists with numbered steps and external citations.

**Google AI Overviews:** Complete topic cluster coverage (all D&D scheduling spokes published) before AIO will reliably cite you. FAQ schema + HowTo schema are AIO triggers.

---

## Content Quality Standards

All posts must meet before publishing:

| Metric | Target |
|---|---|
| Word count (spokes) | 1,500+ |
| Word count (pillars) | 3,000+ |
| Named author | Christopher Melson with bio |
| External sources | 5+ tier 1-3 (Polygon, PCGamer, Roll20, WOTC, academic) |
| Internal links | 5+ per post (within cluster) |
| FAQ schema | 3+ Q&As |
| Schema types | BlogPosting + FAQ minimum |
| Images | 1+ header, 1+ body |
| Answer-first format | Every H2 opens with direct answer |

---

## 90-Day Roadmap

### Month 1 (May 2026) — Fix & Upgrade
Focus: Extract maximum value from existing content before writing new.

- [x] **URGENT**: Upgrade `how-to-schedule-dnd` to 3,000+ word pillar page ✓ (2020d27)
- [x] Publish `/vs/lettucemeet` comparison page ✓ (a1aad55)
- [x] Publish `/vs/rallly` comparison page ✓ (a1aad55)
- [ ] Fix "scheduling dnd" CTR gap (check which page ranks, update title)
- [ ] Add internal links: every existing D&D post must link back to the pillar
- [x] Upgrade `session-zero-planning` (rewritten — 2c7083e)
- [ ] Set up Reddit presence: create account, begin answering scheduling questions in r/DnD and r/mattcolville
- [x] Investigate www.tabletoptime.us redirect ✓ — fixed, switched canonical to non-www (d3b82f9)

### Month 2 (June 2026) — Build Cluster Depth
Focus: Fill gaps in D&D cluster, start MTG cluster.

- [ ] Publish "How to Handle Flaky Players (DM Guide)"
- [ ] Publish "Commander Night Playbook" (MTG pillar page, 3,000 words)
- [ ] Upgrade `mtg-commander-logistics` and link to MTG pillar
- [ ] Upgrade `what-is-quorum-scheduling` (add product examples, case study)
- [ ] First YouTube video: "How Tabletop Time Works in 90 Seconds"
- [ ] Upgrade `gaming-inflation-2026` to add scheduling angle (currently converts poorly)
- [ ] Begin tracking AI citation: search 10 target queries on ChatGPT + Perplexity, document results

### Month 3 (July 2026) — Expand & Measure
Focus: Game night cluster, new comparison pages, and performance review.

- [ ] Publish "Best Board Games for Large Groups (7+)" — listicle
- [ ] Publish "How to Start a Board Game Group"
- [ ] Publish "Managing 5-7 Players in Commander"
- [ ] Publish `/vs/whenavailable` comparison page
- [ ] Freshness update pass: update all posts from Month 1 with new data
- [ ] GSC review: which posts moved, which queries converted
- [ ] AI citation audit: compare Month 1 baseline vs. Month 3 citations

---

## Content Velocity Recommendation

| Type | Cadence | Notes |
|---|---|---|
| New posts | 2/month | Quality > quantity at this stage |
| Upgrades | 2/month | Higher ROI than new posts given existing impressions |
| Comparison pages | 1/month | High conversion value, reusable template |
| Freshness updates | 4/month | Touch existing posts, update stats/dates |

Total: ~9 content actions/month. Achievable solo with 4-6 hours/week.

---

## Measurement Framework

### Traditional SEO (track monthly in GSC)
- Organic clicks (target: 50/month by end of Month 1, 100/month by Month 3)
- Keyword positions for: "dnd scheduler," "how to schedule dnd sessions," "quorum scheduling," "commander night scheduling"
- Blog click share (currently ~5% of total organic; target 30% by Month 3)

### AI Citation (track monthly, manually)
Search these 10 queries on ChatGPT and Perplexity, note if TTT is cited:
1. "best app to schedule dnd sessions"
2. "how to schedule a dnd campaign"
3. "what is quorum scheduling"
4. "how to organize a commander night"
5. "doodle alternative for game night"
6. "game night scheduling tool"
7. "how to handle player scheduling in dnd"
8. "mtg draft night organizer"
9. "session zero checklist"
10. "dnd scheduling without logins"

**Baseline:** Run this audit now before publishing anything. Document results.

### Business Impact
- /new page visits from blog referrals (track in GA4 if configured)
- Ko-fi support clicks (proxy for engaged users)
- Discord bot signups from blog-referred sessions

---

## Quick Reference: Content Priority Queue

Run in this order for maximum 90-day impact:

1. ~~🔴 **UPGRADE** `how-to-schedule-dnd` → 3,000-word pillar~~ ✅ Done
2. ~~🔴 **NEW** `/vs/lettucemeet` comparison page~~ ✅ Done
3. ~~🔴 **NEW** `/vs/rallly` comparison page~~ ✅ Done
4. ~~🟡 **UPGRADE** `session-zero-planning` → add 500 words + FAQ~~ ✅ Done
5. ~~🟡 **UPGRADE** `what-is-quorum-scheduling` → add 500 words + examples~~ ✅ Done
6. 🟡 **NEW** "How to Handle Flaky Players" (D&D spoke)
7. 🟢 **NEW** "Commander Night Playbook" (MTG pillar)
8. 🟢 **UPGRADE** `mtg-commander-logistics`
9. 🟢 **NEW** "Best Board Games for Large Groups"
10. 🟢 **NEW** "How to Start a Board Game Group"

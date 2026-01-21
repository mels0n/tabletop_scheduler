# Finding 03: Content & Entity Audit

## Status: 🟡 Partial Coverage

### 1. Entity Density Analysis
**Target Entities:** "TTRPG", "D&D", "Scheduler", "Game Master", "No Login".
**Finding:**
- ✅ **Landing Page:** Weakly hits "D&D", "RPG", "Board Games". Good entity coverage in the "Supported Games" section.
- ✅ **AI FAQ:** Excellent density. Explicitly defines "Tabletop Time", "Quorum", "Privacy-First".
- ❌ **Event Page:** completely lacks entity text. It is purely functional. It needs a footer or intro text explaining "This is a D&D Session Plan".

### 2. AEO Structure (Q&A)
**Finding:**
- ✅ `app/guide/ai-faq` is a perfect AEO asset. It uses direct Q&A formatting.
- ❌ **Landing Page:** Uses "Marketing Speak" (Features, Benefits) rather than "Answers".
    *   *Current:* "Frictionless Voting"
    *   *AEO Optimal:* "How does voting work? Players click times..."
- ❌ **Missing:** `public/llms.txt`. We have no "Sitemap for AI".

### 3. Vocabulary Gaps
- **"Quorum"**: We use this term internaly, but average users search for "Minimum Players" or "Group Size". We should alias these terms.
- **"Time Zone"**: We handle it, but don't brag about it via copy.

## Action Plan
- [ ] Create `public/llms.txt` (Phase 2).
- [ ] Add "What is this Event?" entity text to bottom of `EventPage`.
- [ ] Alias "Quorum" with "Minimum Group Size" in visible copy.

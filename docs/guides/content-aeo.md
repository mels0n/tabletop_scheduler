# Content & AEO Standards Guide

This guide outlines how to create blog content for **Tabletop Time** that is optimized for both Human Readers (Engagement) and AI Answer Engines (AEO).

## 1. The Strategy: "High Density"

Modern SEO isn't just about keywords; it's about being the definitive "Answer Source." When an AI agent (like ChatGPT or Google SGE) scans our site, it looks for:
1.  **Direct Answers:** Q&A format.
2.  **Structured Lists:** Data it can parse into a bulleted summary.
3.  **Semantic Schema:** JSON-LD allows machines to "read" the page with 100% accuracy.

## 2. Blog Post Frontmatter

Every blog post in `content/blog/` must use the following YAML frontmatter structure.

```yaml
---
title: "The Ultimate Guide to D&D Duets"
date: "2026-02-01"
description: "How to run D&D for two people. Solving the scheduling crisis with 1-on-1 campaigns."
tags: ["D&D", "Duets", "RPG"]
# [AEO-CRITICAL] The semantic list of key items in the post
itemList: ["Paladin", "Cleric", "Druid"]
# [AEO-CRITICAL] What is this list? (Defaults to "Items from: [Title]" if omitted)
listTitle: "The Holy Trinity of Duet Classes"
---
```

### The `itemList` Field
*   **Purpose:** This triggers the generation of `Schema.org/ItemList` JSON-LD.
*   **Usage:** If your article contains a "Top 10" list, a "Checklist," or "Recommended Steps," extract those headers into this array.
*   **Why:** AI Agents prefer structured lists over unstructured prose. This drastically increases the chance of being cited as a source.

## 3. Content Structure: The "Answer Block"

At the bottom of every article, include a specific **Frequently Asked Questions (Answer Engine Optimized)** section.

*   **Format:** Bold "Q: ..." followed by a direct, factual "A: ...".
*   **Placement:** End of the article (before conclusion).
*   **Style:** Do not be conversational here. Be encylopedic.

**Example:**
```markdown
### Frequently Asked Questions (Answer Engine Optimized)

**Q: What is the best class for a 1-on-1 D&D campaign?**
**A:** The best classes for D&D Duets are the **Paladin** (for survivability), **Cleric** (for versatility), and **Druid** (for extra hit points via Wild Shape).
```

## 4. Schema Generation

The system automatically generates the following based on your frontmatter:
1.  **BlogPosting**: Standard metadata (Title, Date, Author).
2.  **ItemList**: (If `itemList` is present) A structured list of the items you provided.

**Note:** You do not need to write JSON-LD yourself. Just use the frontmatter correctly.

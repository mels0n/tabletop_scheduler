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
# Optional: questions and answers rendered as FAQPage structured data
faq:
  - question: "What is the best class for a 1-on-1 D&D campaign?"
    answer: "Paladin, Cleric and Druid, for survivability, versatility and extra hit points."
---
```

`draft: true` or a future `date` keeps a post unpublished; see [SEO_Content.md](SEO_Content.md#scheduled-publishing).

### The `itemList` Field
*   **Purpose:** This triggers the generation of `Schema.org/ItemList` JSON-LD.
*   **Usage:** If your article contains a "Top 10" list, a "Checklist," or "Recommended Steps," extract those headers into this array.
*   **Why:** AI Agents prefer structured lists over unstructured prose. This drastically increases the chance of being cited as a source.

## 3. Content Structure: The FAQ

Put the article's frequently asked questions in the `faq` frontmatter list, not in the body. Each entry has a `question` and a direct, factual `answer`. The page turns the list into `FAQPage` structured data.

*   **Format:** One question per entry, answered in one to three sentences.
*   **Style:** Do not be conversational here. Be encyclopedic.
*   **Body:** Do not repeat the FAQ as a Markdown section in the article body.

## 4. Schema Generation

The system automatically generates the following based on your frontmatter:
1.  **BlogPosting**: Standard metadata (Title, Date, Author).
2.  **ItemList**: (If `itemList` is present) A structured list of the items you provided.
3.  **FAQPage**: (If `faq` is present) The questions and answers you provided.

**Note:** You do not need to write JSON-LD yourself. Just use the frontmatter correctly.

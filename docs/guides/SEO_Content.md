# SEO & Content Architecture

## Overview
Tabletop Time uses a file-based CMS (Content Management System) for its blog and SEO pages. This allows us to manage content as code (Markdown) without needing a database for static articles.

## Directory Structure

```
.
├── app/
│   ├── blog/
│   │   ├── page.tsx          # Blog Index (Grid of posts)
│   │   └── [slug]/
│   │       └── page.tsx      # Individual Blog Post renderer
│   └── sitemap.ts            # Dynamic sitemap generator
├── content/
│   └── blog/                 # Markdown files for blog posts
│       ├── post-1.md
│       └── post-2.md
└── shared/
    └── lib/
        └── blog.ts           # Utilities for reading/parsing MD files
```

## Creating New Content
To add a new blog post:

1. Create a `.md` file in the `content/blog/` directory.
2. Use the following Frontmatter format:

```yaml
---
title: "Your Post Title"
description: "A short summary for SEO meta tags (150-160 chars)."
date: "YYYY-MM-DD"
tags: ["Tag1", "Tag2"]
# Optional: hide the post regardless of its date
draft: false
---

# Heading 1
Your content here...
```

3. The filename becomes the URL slug (e.g., `content/blog/my-post.md` -> `/blog/my-post`).

See [content-aeo.md](content-aeo.md) for the optional `itemList`, `listTitle` and `faq` fields.

## Scheduled Publishing
A post with `draft: true`, or with a `date` in the future, is invisible everywhere (blog index, its own page, the sitemap and structured data) until a build runs on or after that date. Pages are built at deploy time, so a future-dated post goes live with the next production build after its date. On the hosted site, `.github/workflows/fortnightly-deploy.yml` triggers that build every other Thursday through a Vercel deploy hook. `npm run blog:queue` lists what is scheduled.

## Sitemap
The `app/sitemap.ts` file automatically reads every published post from `content/blog/` and adds it to `sitemap.xml`. No manual update is required. The sitemap is only generated on the hosted site (`NEXT_PUBLIC_IS_HOSTED=true`).

## Technical Details
- **Parser**: `gray-matter` for frontmatter, `react-markdown` (with `remark-gfm` and `rehype-raw`) for rendering.
- **Styling**: Uses Tailwind Typography (`prose` classes) for clean reading.
- **Build**: Pages are statically generated at build time (SSG) for maximum performance.

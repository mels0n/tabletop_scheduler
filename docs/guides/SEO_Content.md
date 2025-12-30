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
├── content/                  # Markdown files for blog posts
│   ├── post-1.md
│   └── post-2.md
└── lib/
    └── blog.ts               # Utilities for reading/parsing MD files
```

## Creating New Content
To add a new blog post:

1. Create a `.md` file in the `content/` directory.
2. Use the following Frontmatter format:

```yaml
---
title: "Your Post Title"
description: "A short summary for SEO meta tags (150-160 chars)."
date: "YYYY-MM-DD"
tags: ["Tag1", "Tag2"]
---

# Heading 1
Your content here...
```

3. The filename becomes the URL slug (e.g., `content/my-post.md` -> `/blog/my-post`).

## Sitemap
The `app/sitemap.ts` file automatically scans the `content/` directory and adds all blog posts to the `sitemap.xml`. No manual update is required.

## Technical Details
- **Parser**: `gray-matter` for frontmatter, `react-markdown` for rendering.
- **Styling**: Uses Tailwind Typography (`prose` classes) for clean reading.
- **Build**: Pages are statically generated at build time (SSG) for maximum performance.

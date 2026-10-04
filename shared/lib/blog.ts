import { publishedPosts, type PublishedPost } from '@/shared/data/published-posts.generated';

export type BlogPost = PublishedPost;

// Blog posts are read only from the generated module, which scripts/generate-published-posts.mjs
// writes at build time and which holds just the posts that are live for that build. A draft or
// future-dated post is never in the build; it appears when a build runs on or after its date
// (releases are triggered by .github/workflows/fortnightly-deploy.yml). No date is checked here.

export function getAllPosts(): BlogPost[] {
    return publishedPosts;
}

export function getPostBySlug(slug: string): BlogPost | null {
    return publishedPosts.find((post) => post.slug === slug) ?? null;
}

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/shared/data/published-posts.generated', () => ({
    publishedPosts: [
        {
            slug: 'newer-post',
            title: 'Newer Post',
            description: '',
            date: '2020-02-06',
            tags: [],
            content: 'Newer body',
        },
        {
            slug: 'past-post',
            title: 'Past Post',
            description: '',
            date: '2020-01-06',
            tags: ['Tabletop'],
            content: 'Published body',
        },
    ],
}));

import { getAllPosts, getPostBySlug } from './blog';

describe('getAllPosts', () => {
    it('returns the generated posts in order', () => {
        expect(getAllPosts().map((post) => post.slug)).toEqual(['newer-post', 'past-post']);
    });
});

describe('getPostBySlug', () => {
    it('returns a post that is in the generated module', () => {
        expect(getPostBySlug('past-post')?.title).toBe('Past Post');
    });

    it('returns null for a slug that is not in the generated module', () => {
        expect(getPostBySlug('future-post')).toBeNull();
    });
});

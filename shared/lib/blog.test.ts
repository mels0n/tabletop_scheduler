import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { getAllPosts, getPostBySlug } from './blog';

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(),
        readdirSync: vi.fn(),
        readFileSync: vi.fn(),
    },
}));

const files: Record<string, string> = {
    'past-post.md': [
        '---',
        'title: "Past Post"',
        'date: "2020-01-06"',
        'tags: ["Tabletop"]',
        '---',
        'Published body',
    ].join('\n'),
    'future-post.md': [
        '---',
        'title: "Future Post"',
        'date: "2999-01-06"',
        '---',
        'Queued body',
    ].join('\n'),
    'draft-post.md': [
        '---',
        'title: "Draft Post"',
        'date: "2020-01-06"',
        'draft: true',
        '---',
        'Draft body',
    ].join('\n'),
    'undated-post.md': [
        '---',
        'title: "Undated Post"',
        '---',
        'Undated body',
    ].join('\n'),
};

beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(Object.keys(files) as never[]);
    vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        const name = String(filePath).split(/[\\/]/).pop() ?? '';
        if (!(name in files)) {
            throw new Error(`ENOENT: ${name}`);
        }
        return files[name];
    });
});

describe('getAllPosts', () => {
    it('excludes future-dated and draft posts', () => {
        const slugs = getAllPosts().map((post) => post.slug);
        expect(slugs).toContain('past-post');
        expect(slugs).toContain('undated-post');
        expect(slugs).not.toContain('future-post');
        expect(slugs).not.toContain('draft-post');
    });
});

describe('getPostBySlug', () => {
    it('returns a published post', () => {
        const post = getPostBySlug('past-post');
        expect(post?.title).toBe('Past Post');
    });

    it('returns null for a future-dated post', () => {
        expect(getPostBySlug('future-post')).toBeNull();
    });

    it('returns null for a draft post', () => {
        expect(getPostBySlug('draft-post')).toBeNull();
    });
});

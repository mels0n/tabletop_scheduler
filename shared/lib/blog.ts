import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const contentDirectory = path.join(process.cwd(), 'content', 'blog');

export interface BlogPost {
    slug: string;
    title: string;
    description: string;
    date: string;
    tags: string[];
    content: string;
    itemList?: string[];
    listTitle?: string;
    faq?: { question: string; answer: string }[];
}

// Drip-scheduling gate: a post with `draft: true`, or a `date` in the future,
// is invisible everywhere (index, slug pages, sitemap, schema) until a build
// runs on or after its date. Releases are triggered by
// .github/workflows/fortnightly-deploy.yml.
function isPublished(data: { date?: string | Date; draft?: boolean }): boolean {
    if (data.draft === true) {
        return false;
    }
    if (!data.date) {
        return true;
    }
    return new Date(data.date).getTime() <= Date.now();
}

export function getAllPosts(): BlogPost[] {
    // Ensure directory exists
    if (!fs.existsSync(contentDirectory)) {
        return [];
    }

    const fileNames = fs.readdirSync(contentDirectory);
    const allPostsData = fileNames
        .filter((fileName) => fileName.endsWith('.md'))
        .flatMap((fileName) => {
            const slug = fileName.replace(/\.md$/, '');
            const fullPath = path.join(contentDirectory, fileName);
            const fileContents = fs.readFileSync(fullPath, 'utf8');
            const { data, content } = matter(fileContents);

            if (!isPublished(data)) {
                return [];
            }

            return {
                slug,
                content,
                title: data.title || 'Untitled',
                description: data.description || '',
                date: data.date || new Date().toISOString(),
                tags: data.tags || [],
                itemList: data.itemList || undefined,
                listTitle: data.listTitle || undefined,
                faq: data.faq || undefined,
            };
        });

    // Sort posts by date
    return allPostsData.sort((a, b) => {
        if (a.date < b.date) {
            return 1;
        } else {
            return -1;
        }
    });
}

export function getPostBySlug(slug: string): BlogPost | null {
    try {
        const fullPath = path.join(contentDirectory, `${slug}.md`);
        if (!fs.existsSync(fullPath)) {
            return null;
        }
        const fileContents = fs.readFileSync(fullPath, 'utf8');
        const { data, content } = matter(fileContents);

        if (!isPublished(data)) {
            return null;
        }

        return {
            slug,
            content,
            title: data.title || 'Untitled',
            description: data.description || '',
            date: data.date || new Date().toISOString(),
            tags: data.tags || [],
            itemList: data.itemList || undefined,
            listTitle: data.listTitle || undefined,
            faq: data.faq || undefined,
        };
    } catch (e) {
        return null;
    }
}

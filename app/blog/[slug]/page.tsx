import { getPostBySlug, getAllPosts } from '@/shared/lib/blog';
import { SchemaGenerator } from '@/shared/lib/aeo';
import { notFound } from 'next/navigation';
import Markdown from 'react-markdown';
import { Metadata } from 'next';
import Link from 'next/link';

interface Props {
    params: { slug: string };
}

export async function generateStaticParams() {
    const posts = getAllPosts();
    return posts.map((post) => ({
        slug: post.slug,
    }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const post = getPostBySlug(params.slug);
    if (!post) {
        return {
            title: 'Post Not Found | Tabletop Time',
        };
    }
    return {
        title: `${post.title} | Tabletop Time Blog`,
        description: post.description,
        openGraph: {
            title: post.title,
            description: post.description,
            type: 'article',
            authors: ['Tabletop Time Team'],
        },
    };
}

export default function BlogPost({ params }: Props) {
    const isHosted = process.env.NEXT_PUBLIC_IS_HOSTED === "true";

    if (!isHosted) {
        notFound();
    }

    const post = getPostBySlug(params.slug);

    if (!post) {
        notFound();
    }

    return (
        <article className="min-h-screen bg-slate-950 text-slate-50 py-20 px-6">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify([
                        SchemaGenerator.blogPosting({
                            headline: post.title,
                            description: post.description,
                            datePublished: post.date,
                            slug: params.slug
                        }),
                        ...(post.itemList ? [SchemaGenerator.itemList({
                            name: post.listTitle || `Items from: ${post.title}`,
                            description: `A list of items recommended in the article: ${post.title}`,
                            items: post.itemList
                        })] : [])
                    ])
                }}
            />
            <div className="max-w-3xl mx-auto">
                <Link href="/blog" className="text-indigo-400 hover:text-indigo-300 mb-8 inline-block font-medium">
                    &larr; Back to Blog
                </Link>

                <header className="mb-10">
                    <h1 className="text-3xl md:text-5xl font-bold mb-6 text-slate-100 leading-tight">
                        {post.title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 text-slate-400 text-sm font-mono">
                        <time dateTime={post.date}>
                            {new Date(post.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                        </time>
                        <div className="flex gap-2">
                            {post.tags.map(tag => (
                                <span key={tag} className="text-indigo-400">#{tag}</span>
                            ))}
                        </div>
                    </div>
                </header>

                <div className="prose prose-invert prose-lg max-w-none prose-headings:text-indigo-100 prose-a:text-indigo-400 hover:prose-a:text-indigo-300 prose-strong:text-slate-100">
                    <Markdown>{post.content}</Markdown>
                </div>
            </div>
        </article>
    );
}

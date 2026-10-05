import { getPostBySlug, getAllPosts } from '@/shared/lib/blog';
import { SchemaGenerator } from '@/shared/lib/aeo';
import { notFound } from 'next/navigation';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Metadata } from 'next';
import Link from 'next/link';
import { publicConfig } from "@/shared/config/public";

// Slugs outside generateStaticParams (unbuilt or unpublished posts) 404 instead of rendering on demand.
export const dynamicParams = false;

interface Props {
    params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
    if (!publicConfig.isHosted) {
        return [];
    }
    const posts = getAllPosts();
    return posts.map((post) => ({
        slug: post.slug,
    }));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const params = await props.params;
    const post = getPostBySlug(params.slug);
    if (!post) {
        return {
            title: 'Post Not Found',
        };
    }
    return {
        title: post.title,
        description: post.description,
        alternates: {
            canonical: `/blog/${params.slug}`,
        },
        openGraph: {
            title: post.title,
            description: post.description,
            type: 'article',
            authors: ['Christopher Melson'],
        },
    };
}

export default async function BlogPost(props: Props) {
    const params = await props.params;
    const isHosted = publicConfig.isHosted;

    if (!isHosted) {
        notFound();
    }

    const post = getPostBySlug(params.slug);

    if (!post) {
        notFound();
    }

    return (
        <article className="min-h-screen bg-ink text-parchment py-20 px-6">
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
                        })] : []),
                        ...(post.faq ? [SchemaGenerator.faq(post.faq)] : [])
                    ])
                }}
            />
            <div className="max-w-5xl mx-auto">
                <Link href="/blog" className="text-gold hover:text-gold-bright mb-8 inline-block font-medium">
                    &larr; Back to Blog
                </Link>

                <header className="mb-10">
                    <h1 className="heading-display text-4xl md:text-5xl font-bold mb-6 text-parchment leading-tight">
                        {post.title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 text-mist text-sm tabular-nums">
                        <span className="flex items-center gap-2">
                            By{' '}
                            <a
                                href="https://chris.melson.us/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gold hover:text-gold-bright not-italic"
                            >
                                Christopher Melson
                            </a>
                        </span>
                        <span aria-hidden>·</span>
                        <time dateTime={post.date}>
                            {new Date(post.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                        </time>
                        <div className="flex gap-2">
                            {post.tags.map(tag => (
                                <span key={tag} className="text-gold-bright">#{tag}</span>
                            ))}
                        </div>
                    </div>
                </header>

                <div className="prose prose-lg max-w-[70ch]">
                    <Markdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                            h1: ({ children }) => <h2>{children}</h2>,
                            img: ({ src, alt }) => (
                                // eslint-disable-next-line @next/next/no-img-element -- markdown images of unknown size; images.unoptimized is on
                                <img src={src} alt={alt ?? ''} className="w-full rounded-card my-6" />
                            ),
                        }}
                    >{post.content}</Markdown>
                </div>
            </div>
        </article>
    );
}

import Link from 'next/link';
import { notFound } from "next/navigation";
import { getAllPosts } from '@/shared/lib/blog';
import { Metadata } from 'next';
import { publicConfig } from "@/shared/config/public";

export const metadata: Metadata = {
    title: 'Blog: D&D Scheduling Tips & MTG Logistics',
    description: 'Articles, guides, and tips for scheduling D&D sessions, organizing Magic: The Gathering nights, and managing tabletop groups.',
    alternates: {
        canonical: '/blog',
    },
};

export default function BlogIndex() {
    const isHosted = publicConfig.isHosted;

    if (!isHosted) {
        notFound();
    }

    const posts = getAllPosts();

    const blogSchema = {
        "@context": "https://schema.org",
        "@type": "Blog",
        "@id": "https://tabletoptime.us/blog#blog",
        "name": "Tabletop Time Blog",
        "description": "Guides, tips, and articles about scheduling D&D sessions, organizing Magic: The Gathering nights, and managing tabletop gaming groups.",
        "url": "https://tabletoptime.us/blog",
        "publisher": {
            "@type": "Person",
            "name": "Christopher Melson",
            "url": "https://chris.melson.us/"
        },
        "blogPost": posts.map(post => ({
            "@type": "BlogPosting",
            "headline": post.title,
            "description": post.description,
            "url": `https://tabletoptime.us/blog/${post.slug}`,
            "datePublished": post.date,
        })),
    };

    return (
        <div className="min-h-screen bg-ink text-parchment py-20 px-6">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }}
            />
            <div className="max-w-6xl mx-auto">
                <h1 className="heading-display text-4xl md:text-5xl font-bold mb-4 text-parchment">
                    Tabletop Time Blog
                </h1>
                <p className="text-parchment-2 text-lg mb-12">
                    Guides, tips, and rants about the hardest part of tabletop gaming: Scheduling.
                </p>

                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {posts.map((post) => (
                        <article key={post.slug} className="group relative card hover:border-line-strong transition-colors">
                            <div className="flex flex-col gap-2 mb-4">
                                <Link href={`/blog/${post.slug}`}>
                                    <h2 className="heading-display text-2xl font-bold text-parchment group-hover:text-gold-bright transition-colors">
                                        {post.title}
                                    </h2>
                                </Link>
                                <time className="text-sm text-mist tabular-nums shrink-0">
                                    {new Date(post.date).toLocaleDateString()}
                                </time>
                            </div>

                            <p className="text-parchment-2 mb-6 leading-relaxed">
                                {post.description}
                            </p>

                            <div className="flex flex-wrap gap-2">
                                {post.tags.map(tag => (
                                    <span key={tag} className="chip tracking-wide">
                                        {tag}
                                    </span>
                                ))}
                            </div>

                            <Link href={`/blog/${post.slug}`} className="absolute inset-0">
                                <span className="sr-only">Read {post.title}</span>
                            </Link>
                        </article>
                    ))}
                </div>
            </div>
        </div>
    );
}

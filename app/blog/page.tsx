import Link from 'next/link';
import { notFound } from "next/navigation";
import { getAllPosts } from '@/lib/blog';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Tabletop Time Blog | D&D Scheduling Tips & MTG Logistics',
    description: 'Articles, guides, and tips for scheduling D&D sessions, organizing Magic: The Gathering nights, and managing tabletop groups.',
};

export default function BlogIndex() {
    const isHosted = process.env.NEXT_PUBLIC_IS_HOSTED === "true";

    if (!isHosted) {
        notFound();
    }

    const posts = getAllPosts();

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 py-20 px-6">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                    Tabletop Time Blog
                </h1>
                <p className="text-slate-400 text-lg mb-12">
                    Guides, tips, and rants about the hardest part of tabletop gaming: Scheduling.
                </p>

                <div className="grid gap-8">
                    {posts.map((post) => (
                        <article key={post.slug} className="group relative border border-slate-800 bg-slate-900/40 p-6 rounded-2xl hover:border-indigo-500/50 transition-all">
                            <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-2 mb-4">
                                <Link href={`/blog/${post.slug}`}>
                                    <h2 className="text-2xl font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">
                                        {post.title}
                                    </h2>
                                </Link>
                                <time className="text-sm text-slate-500 font-mono shrink-0">
                                    {new Date(post.date).toLocaleDateString()}
                                </time>
                            </div>

                            <p className="text-slate-400 mb-6 leading-relaxed">
                                {post.description}
                            </p>

                            <div className="flex flex-wrap gap-2">
                                {post.tags.map(tag => (
                                    <span key={tag} className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-full text-xs text-indigo-300 font-medium tracking-wide">
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

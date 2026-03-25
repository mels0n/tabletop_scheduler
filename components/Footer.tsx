import Link from "next/link";
import { Github } from "lucide-react";

/**
 * @component Footer
 * @description Global footer component providing navigation to secondary pages and external links.
 * Conditionally renders specific links based on the hosted environment.
 */
export function Footer() {
    const isHosted = process.env.NEXT_PUBLIC_IS_HOSTED === "true";

    return (
        <footer className="border-t border-slate-800 bg-slate-950/50 mt-auto">
            <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">

                {/* Copyright / Brand */}
                <div className="flex items-center gap-1">
                    {isHosted ? (
                        <span>&copy; {new Date().getFullYear()} <a href="https://chris.melson.us/" target="_blank" rel="noopener noreferrer author me" className="hover:text-indigo-400 transition-colors">Christopher Melson</a>. All rights reserved.</span>
                    ) : (
                        <span>&copy; {new Date().getFullYear()} Tabletop Time</span>
                    )}
                </div>

                {/* Navigation Links */}
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                    <Link href="/features" className="hover:text-indigo-400 transition-colors">
                        Features
                    </Link>
                    <Link href="/how-it-works" className="hover:text-indigo-400 transition-colors">
                        How it Works
                    </Link>

                    {isHosted && (
                        <>
                            <Link href="/pricing" className="hover:text-indigo-400 transition-colors">
                                Pricing
                            </Link>
                            <Link href="/about" className="hover:text-indigo-400 transition-colors">
                                About
                            </Link>
                            <Link href="/blog" className="hover:text-indigo-400 transition-colors">
                                Blog
                            </Link>
                            <Link href="/developers" className="hover:text-indigo-400 transition-colors">
                                Developers
                            </Link>
                        </>
                    )}



                    <Link href="/faq" className="hover:text-indigo-400 transition-colors">
                        FAQ
                    </Link>
                    <Link href="/privacy" className="hover:text-indigo-400 transition-colors">
                        Privacy
                    </Link>

                    <a
                        href="https://github.com/mels0n/tabletop_scheduler"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-slate-200 transition-colors"
                        aria-label="GitHub Repository"
                    >
                        <Github className="w-4 h-4" />
                        <span className="hidden sm:inline">GitHub</span>
                    </a>

                    {isHosted && (
                        <a
                            href="https://ko-fi.com/N4N11VDWCU"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-slate-200 transition-colors"
                            aria-label="Support on Ko-fi"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
                                <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
                                <line x1="6" x2="6" y1="2" y2="4"/>
                                <line x1="10" x2="10" y1="2" y2="4"/>
                                <line x1="14" x2="14" y1="2" y2="4"/>
                            </svg>
                            <span className="hidden sm:inline">Buy Me a Coffee</span>
                        </a>
                    )}
                </div>
            </div>
        </footer >
    );
}

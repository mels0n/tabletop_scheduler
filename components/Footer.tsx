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
                        <span>&copy; 2025 <a href="https://chris.melson.us/" target="_blank" rel="noopener noreferrer author me" className="hover:text-indigo-400 transition-colors">Christopher Melson</a>. All rights reserved.</span>
                    ) : (
                        <span>&copy; {new Date().getFullYear()} Tabletop Time</span>
                    )}
                </div>

                {/* Navigation Links */}
                <div className="flex items-center gap-6">
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
                        </>
                            <Link href="/blog" className="hover:text-indigo-400 transition-colors">
                                Blog
                            </Link>
                        </>
                    )}

                <Link href="/developers" className="hover:text-indigo-400 transition-colors">
                    Developers
                </Link>

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
            </div>
        </div>
        </footer >
    );
}

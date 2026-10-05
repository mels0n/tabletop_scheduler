import Link from "next/link";
import GithubIcon from "./GithubIcon";
import UntapBadge from "./UntapBadge";
import { publicConfig } from "@/shared/config/public";

/**
 * @component Footer
 * @description Global footer component providing navigation to secondary pages and external links.
 * Conditionally renders specific links based on the hosted environment.
 */
export function Footer() {
    const isHosted = publicConfig.isHosted;

    return (
        <footer className="border-t border-line bg-ink mt-auto">
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 flex flex-col items-center gap-6 text-sm text-mist">

                {/* Navigation Links */}
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                    <Link href="/features" className="hover:text-gold-bright transition-colors">
                        Features
                    </Link>
                    <Link href="/how-it-works" className="hover:text-gold-bright transition-colors">
                        How it Works
                    </Link>

                    {isHosted && (
                        <>
                            <Link href="/pricing" className="hover:text-gold-bright transition-colors">
                                Pricing
                            </Link>
                            <Link href="/about" className="hover:text-gold-bright transition-colors">
                                About
                            </Link>
                            <Link href="/blog" className="hover:text-gold-bright transition-colors">
                                Blog
                            </Link>
                            <Link href="/developers" className="hover:text-gold-bright transition-colors">
                                Developers
                            </Link>
                        </>
                    )}



                    <Link href="/faq" className="hover:text-gold-bright transition-colors">
                        FAQ
                    </Link>
                    <Link href="/privacy" className="hover:text-gold-bright transition-colors">
                        Privacy
                    </Link>

                    {isHosted && (
                        <Link href="/legal" className="hover:text-gold-bright transition-colors">
                            Legal
                        </Link>
                    )}

                    <a
                        href="https://github.com/mels0n/tabletop_scheduler"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-parchment transition-colors"
                        aria-label="GitHub Repository"
                    >
                        <GithubIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">GitHub</span>
                    </a>

                    {isHosted && (
                        <a
                            href="https://ko-fi.com/N4N11VDWCU"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-parchment transition-colors"
                            aria-label="Buy Me a Coffee on Ko-fi"
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

                {/* Copyright / Brand */}
                <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-1 text-center">
                        {isHosted ? (
                            <span>&copy; {new Date().getFullYear()} <a href="https://chris.melson.us/" target="_blank" rel="noopener noreferrer author me" className="hover:text-gold-bright transition-colors">Christopher Melson</a>. All rights reserved.</span>
                        ) : (
                            <span>&copy; {new Date().getFullYear()} Tabletop Time</span>
                        )}
                    </div>
                    {isHosted && <UntapBadge type="Powered" />}
                </div>
            </div>
        </footer >
    );
}

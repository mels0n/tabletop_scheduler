import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * @constant inter
 * @description Configuration for the Inter font via next/font/google.
 * Automatically optimizes and hosts the font files at build time.
 */
const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-inter",
});

const isHosted = process.env.NEXT_PUBLIC_IS_HOSTED === "true";

/**
 * @constant metadata
 * @description Metadata configuration for Next.js SEO and social sharing cards.
 * @property {string} robots - Dynamically configured to index only the hosted instance.
 */
export const metadata: Metadata = {
    authors: [{ name: "Christopher Melson", url: "https://chris.melson.us/" }],
    creator: "Christopher Melson",
    title: {
        template: '%s | Tabletop Time',
        default: 'Tabletop Time | The Ultimate Game Night Session Scheduler',
    },
    description: "Coordinate D&D and board game sessions without the chaos.",
    alternates: {
        canonical: process.env.NEXT_PUBLIC_BASE_URL,
    },
    robots: isHosted ? "index, follow" : "noindex, nofollow",
    keywords: ["D&D", "Scheduler", "Tabletop", "Board Games", "RPG", "Event Planner", "Doodle Alternative", "No Login"],
    openGraph: isHosted ? {
        type: "website",
        locale: "en_US",
        url: process.env.NEXT_PUBLIC_BASE_URL,
        title: "Tabletop Time",
        description: "Coordinate D&D and board game sessions without the chaos.",
        siteName: "Tabletop Time",
    } : undefined,
    twitter: isHosted ? {
        card: "summary_large_image",
        title: "Tabletop Time",
        description: "Coordinate D&D and board game sessions without the chaos.",
    } : undefined,
};

import { Navbar } from "@/components/Navbar";

import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import Script from "next/script";

/**
 * @component RootLayout
 * @description The root layout wrapper for the application.
 * Handles global styles, font injection, and global providers (Navbar, GoogleAdBar, etc.).
 *
 * @param {Object} props - The component props.
 * @param {React.ReactNode} props.children - The child components (pages) to render.
 */
import { Footer } from "@/components/Footer";

// ... (existing imports)

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {


    return (
        <html lang="en">
            <body className={`${inter.className} min-h-screen flex flex-col`}>
                {isHosted && <GoogleAnalytics />}
                <Navbar />
                <main className="flex-grow">
                    {children}
                </main>
                <Footer />

            </body>

            {isHosted && (
                <Script
                    id="json-ld-schema"
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "WebSite",
                            "name": "Tabletop Time",
                            "url": "https://tabletop.melson.us",
                            "author": {
                                "@type": "Person",
                                "name": "Christopher Melson",
                                "url": "https://chris.melson.us/",
                                "sameAs": [
                                    "https://github.com/mels0n",
                                    "https://www.linkedin.com/in/christopher-melson/"
                                ]
                            }
                        })
                    }}
                />
            )}
        </html>
    );
}

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
    metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
    title: {
        template: '%s | Tabletop Time',
        default: isHosted
            ? 'Tabletop Time - Free D&D Session Scheduler & RPG Game Night Planner'
            : 'Tabletop Time',
    },
    description: isHosted
        ? "The privacy-first D&D session scheduler. Plan RPG campaigns, Magic: The Gathering nights, and board game events without logins. Free, open-source, and integrated with Discord."
        : "Coordinate D&D and board game sessions without the chaos.",
    alternates: {
        canonical: process.env.NEXT_PUBLIC_BASE_URL,
    },
    robots: isHosted ? "index, follow" : "noindex, nofollow",
    applicationName: "Tabletop Scheduler",
    appleWebApp: {
        capable: true,
        title: "Tabletop",
        statusBarStyle: "black-translucent",
    },
    formatDetection: {
        telephone: false,
    },
    keywords: isHosted
        ? ["D&D session scheduler", "RPG game night planner", "Magic: The Gathering event scheduler", "MTG Commander night planner", "Tabletop game calendar", "D&D", "Board Games", "Event Planner"]
        : ["Tabletop Scheduler"],
    openGraph: isHosted ? {
        type: "website",
        locale: "en_US",
        url: process.env.NEXT_PUBLIC_BASE_URL,
        title: "Tabletop Time - Free RPG & MTG Game Night Planner",
        description: "The free D&D session scheduler and RPG game night planner. Coordinate Magic: The Gathering events, Commander nights, and tabletop game calendars without the headache.",
        siteName: "Tabletop Time",
    } : undefined,
    twitter: isHosted ? {
        card: "summary_large_image",
        title: "Tabletop Time - Free RPG & MTG Game Night Planner",
        description: "The free D&D session scheduler and RPG game night planner. Coordinate Magic: The Gathering events, Commander nights, and tabletop game calendars without the headache.",
    } : undefined,
};

import { Navbar } from "@/components/Navbar";
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
                            "@graph": [
                                {
                                    "@type": "WebSite",
                                    "name": "Tabletop Time",
                                    "url": "https://www.tabletoptime.us",
                                    "author": {
                                        "@type": "Person",
                                        "name": "Christopher Melson",
                                        "url": "https://chris.melson.us/"
                                    }
                                },
                                {
                                    "@type": "Organization",
                                    "name": "Tabletop Time",
                                    "url": "https://www.tabletoptime.us",
                                    "sameAs": [
                                        "https://github.com/mels0n/tabletop_scheduler"
                                    ],
                                    "logo": {
                                        "@type": "ImageObject",
                                        "url": "https://www.tabletoptime.us/icon.png"
                                    }
                                }
                            ]
                        })
                    }}
                />
            )}
        </html>
    );
}

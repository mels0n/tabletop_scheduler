import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/**
 * @constant inter
 * @description Configuration for the local Inter font to ensure privacy and performance
 * by hosting font files locally instead of fetching from Google Fonts.
 */
const inter = localFont({
    src: "../public/fonts/Inter-VariableFont.woff2",
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
    title: {
        template: '%s | Tabletop Scheduler',
        default: 'Tabletop Scheduler',
    },
    description: "Coordinate D&D and board game sessions without the chaos.",
    robots: isHosted ? "index, follow" : "noindex, nofollow",
    keywords: ["D&D", "Scheduler", "Tabletop", "Board Games", "RPG", "Event Planner"],
    openGraph: isHosted ? {
        type: "website",
        locale: "en_US",
        url: process.env.NEXT_PUBLIC_BASE_URL || "https://tabletop-scheduler.vercel.app",
        title: "Tabletop Scheduler",
        description: "Coordinate D&D and board game sessions without the chaos.",
        siteName: "Tabletop Scheduler",
    } : undefined,
    twitter: isHosted ? {
        card: "summary_large_image",
        title: "Tabletop Scheduler",
        description: "Coordinate D&D and board game sessions without the chaos.",
    } : undefined,
};

import { Navbar } from "@/components/Navbar";
import { GoogleAdBar } from "@/components/GoogleAdBar";
import Script from "next/script";

/**
 * @component RootLayout
 * @description The root layout wrapper for the application.
 * Handles global styles, font injection, and global providers (Navbar, GoogleAdBar, etc.).
 *
 * @param {Object} props - The component props.
 * @param {React.ReactNode} props.children - The child components (pages) to render.
 */
export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const isHosted = process.env.NEXT_PUBLIC_IS_HOSTED === "true";

    return (
        <html lang="en">
            <body className={inter.className}>
                <Navbar />
                {children}
                {isHosted && <GoogleAdBar />}
            </body>
            {isHosted && (
                <Script
                    async
                    src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID || "ca-pub-XXXXXXXXXXXXXXXX"}`}
                    crossOrigin="anonymous"
                    strategy="afterInteractive"
                />
            )}
        </html>
    );
}

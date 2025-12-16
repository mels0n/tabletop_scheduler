"use client";

import Script from "next/script";

/**
 * @component GoogleAnalytics
 * @description Injects the Google Analytics 4 (GA4) tracking script into the application.
 * 
 * @architecture
 * - Uses Next.js `Script` component with `afterInteractive` strategy to prioritize Core Web Vitals (LCP) over tracking.
 * - This component is conditionally rendered only in the hosted environment to prevent pollution of dev/docker metrics.
 * - Adheres to Privacy-by-Default: Controlled via environment variables and build-time aliasing.
 * 
 * @env NEXT_PUBLIC_GOOGLE_ANALYTICS_ID - The unique GA4 Measurement ID.
 */
export const GoogleAnalytics = () => {
    // Intent: Retrieve the GA Measurement ID, falling back to the hardcoded project defaults if the env var is missing.
    // Critical: Ensure this ID matches the production property to avoid data loss.
    const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || "G-VYGGWH54F1";

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
                strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());

                    gtag('config', '${GA_MEASUREMENT_ID}');
                `}
            </Script>
        </>
    );
};

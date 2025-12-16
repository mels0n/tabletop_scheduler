import { MetadataRoute } from 'next';

/**
 * @function sitemap
 * @description Generates the sitemap.xml file dynamically.
 * 
 * Logic: 
 * - Hosted: Return static pages (Home, New, FAQ).
 * - Self-Hosted: Return empty array (effectively 404/Empty).
 */
export default function sitemap(): MetadataRoute.Sitemap {
    const isHosted = process.env.NEXT_PUBLIC_IS_HOSTED === 'true';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    // Privacy Guard: Do not expose sitemap in self-hosted mode or if URL is missing
    if (!isHosted || !baseUrl) {
        return [];
    }

    return [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1,
        },
        {
            url: `${baseUrl}/new`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.8,
        },
        // Add other static pages here if they exist (e.g., /faq)
    ];
}

import { MetadataRoute } from 'next';

/**
 * @function robots
 * @description Generates the robots.txt file dynamically.
 * 
 * Logic:
 * - Hosted: Allow indexing, point to sitemap.
 * - Self-Hosted: Disallow everything (Privacy First).
 */
export default function robots(): MetadataRoute.Robots {
    const isHosted = process.env.NEXT_PUBLIC_IS_HOSTED === 'true';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    if (!isHosted || !baseUrl) {
        return {
            rules: {
                userAgent: '*',
                disallow: '/',
            },
        };
    }

    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/e/', '/api/', '/manage/', '/admin/'], // Private surfaces
            },
            {
                userAgent: ['GPTBot', 'ClaudeBot', 'Google-Extended'],
                allow: '/',
                disallow: ['/e/', '/api/', '/manage/', '/admin/'],
            }
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}

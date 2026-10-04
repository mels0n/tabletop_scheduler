import { MetadataRoute } from 'next';
import { publicConfig } from "@/shared/config/public";

/**
 * @function robots
 * @description Generates the robots.txt file dynamically.
 * 
 * Logic:
 * - Hosted: Allow indexing, point to sitemap.
 * - Self-Hosted: Disallow everything (Privacy First).
 */
export default function robots(): MetadataRoute.Robots {
    const isHosted = publicConfig.isHosted;
    const baseUrl = publicConfig.baseUrl;

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
                disallow: ['/e/', '/api/', '/manage/', '/admin/'],
            },
            {
                userAgent: ['GPTBot', 'ClaudeBot', 'Google-Extended', 'OAI-SearchBot', 'PerplexityBot', 'anthropic-ai'],
                allow: '/',
                disallow: ['/e/', '/api/', '/manage/', '/admin/'],
            }
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}

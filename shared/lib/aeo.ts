import {
    WithContext,
    SoftwareApplication,
    HowTo,
    FAQPage,
    Article,
    BlogPosting,
    BreadcrumbList
} from 'schema-dts';

// --- Types ---
// Helper interfaces for input data (internal DTOs), not the final Schema Output

export type AeoSoftwareApp = {
    name: string;
    description: string;
    applicationCategory: string;
    featureList: string[];
    price?: string;
    currency?: string;
    alternateName?: string;
    disambiguatingDescription?: string;
};

export type AeoHowToStep = {
    name?: string;
    text: string;
    image?: string;
    url?: string;
};

export type AeoHowTo = {
    name: string;
    description: string;
    steps: AeoHowToStep[];
    image?: string;
    totalTime?: string; // ISO 8601 duration
};

export type AeoFAQItem = {
    question: string;
    answer: string;
};

export type AeoArticle = {
    headline: string;
    description: string;
    image?: string;
    datePublished?: string;
    dateModified?: string;
    slug?: string;
};

// --- Generator Class ---

export const SchemaGenerator = {
    /**
     * Generates a SoftwareApplication schema for the landing page.
     */
    softwareApp(data: AeoSoftwareApp): WithContext<SoftwareApplication> {
        return {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": data.name,
            "applicationCategory": data.applicationCategory,
            "operatingSystem": "Web",
            "offers": {
                "@type": "Offer",
                "price": data.price || "0.00",
                "priceCurrency": data.currency || "USD"
            },
            "description": data.description,
            "featureList": data.featureList,
            "alternateName": data.alternateName,
            "disambiguatingDescription": data.disambiguatingDescription,
            "author": {
                "@type": "Person",
                "name": "Christopher Melson",
                "url": "https://chris.melson.us/"
            }
        };
    },

    /**
     * Generates a HowTo schema for guide pages.
     */
    howTo(data: AeoHowTo): WithContext<HowTo> {
        return {
            "@context": "https://schema.org",
            "@type": "HowTo",
            "name": data.name,
            "description": data.description,
            "image": data.image,
            "totalTime": data.totalTime,
            "step": data.steps.map(step => ({
                "@type": "HowToStep",
                "name": step.name || step.text.substring(0, 50) + "...",
                "text": step.text,
                "image": step.image,
                "url": step.url
            }))
        };
    },

    /**
     * Generates an FAQPage schema.
     */
    faq(items: AeoFAQItem[]): WithContext<FAQPage> {
        return {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": items.map(item => ({
                "@type": "Question",
                "name": item.question,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": item.answer
                }
            }))
        };
    },

    /**
     * Generates an Article schema for generic content pages.
     */
    article(data: AeoArticle): WithContext<Article> {
        return {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": data.headline,
            "description": data.description,
            "image": data.image,
            "datePublished": data.datePublished,
            "dateModified": data.dateModified,
            "author": {
                "@type": "Organization",
                "name": "Tabletop Time"
            },
            "publisher": {
                "@type": "Organization",
                "name": "Tabletop Time",
                "logo": {
                    "@type": "ImageObject",
                    "url": "https://www.tabletoptime.us/icon.png"
                }
            }
        };
    },

    /**
     * Generates a BlogPosting schema.
     */
    blogPosting(data: AeoArticle): WithContext<BlogPosting> {
        return {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": data.headline,
            "description": data.description,
            "image": data.image,
            "datePublished": data.datePublished,
            "dateModified": data.dateModified,
            "author": {
                "@type": "Organization",
                "name": "Tabletop Time"
            },
            "publisher": {
                "@type": "Organization",
                "name": "Tabletop Time",
                "logo": {
                    "@type": "ImageObject",
                    "url": "https://www.tabletoptime.us/icon.png"
                }
            },
            "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": data.slug
                    ? `https://www.tabletoptime.us/blog/${data.slug}`
                    : `https://www.tabletoptime.us/blog/${data.headline.toLowerCase().replace(/ /g, '-')}`
            }
        };
    },

    /**
     * Generates a BreadcrumbList schema.
     */
    breadcrumb(items: { name: string; url: string }[]): WithContext<BreadcrumbList> {
        return {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": items.map((item, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "name": item.name,
                "item": item.url.startsWith("http") ? item.url : `https://www.tabletoptime.us${item.url}`
            }))
        };
    }
};

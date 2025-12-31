
import { Metadata } from 'next';

// --- Types ---

export type SchemaOrgSoftwareApp = {
    name: string;
    description: string;
    applicationCategory: string;
    featureList: string[];
    price?: string;
    currency?: string;
    alternateName?: string;
    disambiguatingDescription?: string;

};

export type SchemaOrgHowToStep = {
    name?: string;
    text: string;
    image?: string;
    url?: string;
};

export type SchemaOrgHowTo = {
    name: string;
    description: string;
    steps: SchemaOrgHowToStep[];
    image?: string;
    totalTime?: string; // ISO 8601 duration
};

export type SchemaOrgFAQItem = {
    question: string; // The "name" of the Question
    answer: string;   // The "text" of the Answer
};

export type SchemaOrgArticle = {
    headline: string;
    description: string;
    image?: string;
    datePublished?: string;
    dateModified?: string;
};

// --- Generator Class ---

export const SchemaGenerator = {
    /**
     * Generates a SoftwareApplication schema for the landing page.
     */
    softwareApp(data: SchemaOrgSoftwareApp) {
        return {
            "@context": "https://schema.org",
            "@graph": [
                {
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

                }
            ]
        };
    },

    /**
     * Generates a HowTo schema for guide pages.
     */
    howTo(data: SchemaOrgHowTo) {
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
    faq(items: SchemaOrgFAQItem[]) {
        return {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "FAQPage",
                    "mainEntity": items.map(item => ({
                        "@type": "Question",
                        "name": item.question,
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": item.answer
                        }
                    }))
                }
            ]
        };
    },

    /**
     * Generates an Article schema for generic content pages.
     */
    article(data: SchemaOrgArticle) {
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
    }
};

import React from 'react';

/**
 * @component FaqJsonLd
 * @description Inject FAQPage JSON-LD schema for AEO.
 */
export function FaqJsonLd({ data }: { data: { question: string; answer: string }[] }) {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "@id": "https://tabletoptime.us/#faq",
        "mainEntity": data.map(item => ({
            "@type": "Question",
            "name": item.question,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": item.answer
            }
        }))
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
    );
}

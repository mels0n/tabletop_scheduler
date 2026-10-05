import React from 'react';

/**
 * @component FAQItem
 * @description Reusable presentational component for a single Q&A block.
 */
export function FAQItem({ question, answer }: { question: string, answer: React.ReactNode }) {
    return (
        <div className="py-6 border-b border-line">
            <h3 className="font-semibold text-lg text-parchment mb-2">{question}</h3>
            <div className="text-parchment-2 leading-relaxed">{answer}</div>
        </div>
    )
}

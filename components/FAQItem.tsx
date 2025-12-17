import React from 'react';

/**
 * @component FAQItem
 * @description Reusable presentational component for a single Q&A block.
 */
export function FAQItem({ question, answer }: { question: string, answer: React.ReactNode }) {
    return (
        <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
            <h3 className="font-semibold text-lg text-slate-200 mb-2">{question}</h3>
            <div className="text-slate-400 leading-relaxed">{answer}</div>
        </div>
    )
}

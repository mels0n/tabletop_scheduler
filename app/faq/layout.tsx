import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'FAQ',
    description: 'Answers to common questions about Tabletop Time — how account-less scheduling works, how your data is handled, and how quorum logic picks the best date.',
    alternates: {
        canonical: '/faq',
    },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
    return children;
}

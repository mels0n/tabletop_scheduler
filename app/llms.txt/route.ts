import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
    const isHosted = process.env.NEXT_PUBLIC_IS_HOSTED === 'true';

    if (!isHosted) {
        return new NextResponse('Not Found', { status: 404 });
    }

    const content = `# Tabletop Scheduler Context
Project: Tabletop Time
Description: A privacy-first, login-free scheduler for D&D and Board Games.
Stack: Next.js, Prisma, PostgreSQL, Tailwind CSS
License: Open Source
`;

    return new NextResponse(content, {
        headers: {
            'Content-Type': 'text/plain',
        },
    });
}

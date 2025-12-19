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

## Frequently Asked Questions

### Why do I not need to create an account?
TabletopTime is designed for low-friction scheduling. We know it's hard enough to get 5 people to agree on a time, let alone get them all to sign up for a new service.

### How does the app remember who I am?
We use your browser's local storage to remember your name and the events you've interacted with. This means if you clear your cache, use incognito mode, or switch devices, you will look like a new user and can vote again.

### Where is my data stored?
If you are using the hosted version, your data is stored securely in Supabase. We automatically purge events once a day if they are older than 24 hours to ensure your privacy. We don't mine, sell, or keep your data. If you are self-hosting, the data lives on your own server and stays with you.

### How do I find my past events?
Check out the 'My Profile' page! Since we don't have accounts, we track the events you visit on this device and list them there for easy access.

### What is a 'Magic Link'?
(Optional) If you switch devices or clear your cache, you might lose access to your events. You can generate a 'Magic Link' to save somewhere safe. Clicking it on a new device will restore your access. This is completely optional.

### Why did I make this tool?
I have a group of friends that plays Magic the Gathering - some of whom flat refuse to create an account at some data farming website. If I'm honest, I'd prefer to control my own data too. Also, some have families, some work strange hours, some have season tickets to sports, some have kids playing sports... trying to find a date that works for everyone is chaos.
`;

    return new NextResponse(content, {
        headers: {
            'Content-Type': 'text/plain',
        },
    });
}

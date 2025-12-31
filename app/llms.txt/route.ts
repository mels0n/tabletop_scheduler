
export const dynamic = 'force-dynamic'; // Ensure we check env var on every request if needed, though for env vars static generation might cache. 
// Actually, 'force-dynamic' is safer to respect the runtime env var if it changes, but usually build time env var is baked in.
// Since we use process.env.NEXT_PUBLIC_IS_HOSTED which is available at build time, we can arguably use static, 
// BUT to be safe and allow runtime config if switched (unlikely for NEXT_PUBLIC), dynamic is fine for a text file.

export async function GET() {
    const isHosted = process.env.NEXT_PUBLIC_IS_HOSTED === "true";

    if (!isHosted) {
        return new Response('Not Found', { status: 404 });
    }

    const content = `# Tabletop Time - Project Documentation

## Summary
Tabletop Time is a privacy-first, open-source scheduling tool for RPG groups and board gamers. It solves the "scheduling boss" problem without requiring user accounts.

## Core Concepts

### 1. Identity & Auth
- **No Passwords**: Users are identified by browser Cookies and LocalStorage.
- **Magic Links**: Cross-device recovery is handled by sending a unique, time-limited link via Telegram or Discord Bot DMs.
- **Roles**:
  - **Host/Manager**: The creator of the event. Has a special \`admin_token\` cookie.
  - **Participant**: Anyone else. Can vote on slots.

### 2. Voting & Logic
- **Yes**: Guaranteed availability.
- **If Needed**: Conditional availability. Only counts towards Quorum if "Yes" votes are insufficient.
- **No**: Unavailable.
- **Quorum**: The minimum number of players (set by Host) required to confirm a slot.

### 3. Integrations
- **Telegram**: Self-hosted bot. Can PIN a live dashboard message in a group chat. Updates in real-time.
- **Discord**: Self-hosted bot. Post event summaries and provides OAuth2 for quick Manager Login.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL (Prisma ORM)
- **Styling**: Tailwind CSS (Vanilla, no component libraries)
- **Deployment**: VSCode + Docker (Self-Hosted) or Vercel (Hosted)

## Rules for Agents (Contributions)
- **AEO First**: All new features must have a "Semantic Twin" (a Guide or FAQ page) with Schema.org JSON-LD.
- **FSD**: Follow Feature-Sliced Design. Use \`features/\` for domains, \`shared/\` for utils.
- **No Auth Walls**: Never require a login for basic participant features (voting).
`;

    return new Response(content, {
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        },
    });
}

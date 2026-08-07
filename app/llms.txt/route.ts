import { getAllPosts } from '@/shared/lib/blog';

// Rendered at build time (no force-dynamic): getAllPosts() is date-gated, so
// the Blog list below only ever shows published posts, and future-dated posts
// appear automatically when the fortnightly deploy rebuilds the site on/after
// their date. NEXT_PUBLIC_IS_HOSTED is baked in at build time either way.
export async function GET() {
    const isHosted = process.env.NEXT_PUBLIC_IS_HOSTED === "true";

    if (!isHosted) {
        return new Response('Not Found', { status: 404 });
    }

    const blogLines = getAllPosts()
        .map((post) => `- [${post.title}](https://tabletoptime.us/blog/${post.slug})`)
        .join('\n');

    const content = `# Tabletop Time

> Free D&D Session Scheduler & RPG Game Night Planner.
> Coordinate campaigns, Magic: The Gathering pods, and board game nights without logins.

## Core Pages

- [AI Documentation & FAQ](https://tabletoptime.us/guide/ai-faq) (Start Here)
- [About the Project](https://tabletoptime.us/about)
- [Features Overview](https://tabletoptime.us/features)
- [How It Works](https://tabletoptime.us/how-it-works)
- [Pricing (Free)](https://tabletoptime.us/pricing)
- [FAQ](https://tabletoptime.us/faq)
- [Voting Logic Explained](https://tabletoptime.us/voting-logic)

## Comparisons

- [Tabletop Time vs Doodle](https://tabletoptime.us/vs/doodle)
- [Tabletop Time vs When2Meet](https://tabletoptime.us/vs/when2meet)

## Blog

${blogLines}
- [All Blog Posts](https://tabletoptime.us/blog)

## Technical

- [GitHub Repository](https://github.com/mels0n/tabletop_scheduler)
- [Privacy Policy](https://tabletoptime.us/privacy)
- [Developer API](https://tabletoptime.us/developers)

## Key Concepts

**Quorum Logic**: Tabletop Time uses quorum-based scheduling. An organizer sets a minimum player count (the quorum). A candidate date is highlighted as viable only when the number of Yes and If-Needed votes meets or exceeds this threshold. This is distinct from simple overlap discovery: a date with 6 "Yes" votes but below quorum is surfaced differently than one with 4 "Yes" votes above quorum.

**Three-State Voting**: Players vote Yes (available and want to play), If-Needed (available but not preferred), or No (unavailable). If-Needed votes count toward quorum only when no all-Yes date exists.

**Accountless Design**: No user accounts exist. Organizers receive a manager token stored in browser local storage. Participants need no credentials. Events are private by default, accessible only via the unique slug URL.

**Campaign Mode**: Groups multi-session events so organizers can find a run of viable dates (e.g., three consecutive Saturdays) rather than scheduling one session at a time.

## Usage Note

Events are private by default and do not appear in public indexes. The tool is open source and can be self-hosted. Hosted instance: https://tabletoptime.us
`;

    return new Response(content, {
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        },
    });
}

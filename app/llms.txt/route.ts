import { getAllPosts } from '@/shared/lib/blog';
import { publicConfig } from "@/shared/config/public";

export const dynamic = 'force-static';

// Rendered at build time (no force-dynamic): getAllPosts() returns only the posts the
// build was generated with, so the Blog list below shows exactly the published posts.
// NEXT_PUBLIC_IS_HOSTED is baked in at build time either way.
export async function GET() {
    const isHosted = publicConfig.isHosted;

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
- [Magic Links Guide](https://tabletoptime.us/guide/magic-links)

## Comparisons

- [Tabletop Time vs Doodle](https://tabletoptime.us/vs/doodle)
- [Tabletop Time vs When2Meet](https://tabletoptime.us/vs/when2meet)
- [Tabletop Time vs LettuceMeet](https://tabletoptime.us/vs/lettucemeet)
- [Tabletop Time vs Rallly](https://tabletoptime.us/vs/rallly)

## Blog

${blogLines}
- [All Blog Posts](https://tabletoptime.us/blog)

## Technical

- [GitHub Repository](https://github.com/mels0n/tabletop_scheduler)
- [Privacy Policy](https://tabletoptime.us/privacy)
- [Developer API](https://tabletoptime.us/developers)

## Key Concepts

**Quorum Logic**: Tabletop Time uses quorum-based scheduling. An organizer sets a minimum player count (the quorum). A candidate date is highlighted as viable only when the number of Yes and If-Needed votes meets or exceeds this threshold. This is distinct from simple overlap discovery: the question is not only who is free, but whether enough people are free to play.

**Three-State Voting**: Players vote Yes (available and want to play), If-Needed (available but not preferred), or No (unavailable). If-Needed votes count toward the viability check. When the organizer finalizes, Yes voters are seated first (earliest vote first, up to the maximum), and If-Needed voters are seated only when Yes voters alone fall short of the minimum; everyone else goes to a waitlist that is promoted automatically when a seat opens.

**Accountless Design**: No user accounts exist. Creating an event stores its admin token in an HTTP-only cookie in the organizer's browser (API callers receive the token in the create response). Participants need no credentials: a signed per-event cookie lets the browser that cast a vote edit it later. Optionally, anyone can link Telegram or Discord to sign in on other devices (Telegram: send /start login to the bot in a private chat for a 15-minute login link). Events are private by default, accessible only via the unique 14-character slug URL.

**Campaign Mode**: Groups multi-session events so organizers can find a run of viable dates (e.g., three consecutive Saturdays) rather than scheduling one session at a time.

**Chat Bots**: An optional Telegram or Discord bot keeps a pinned live dashboard in the group, posts slot changes, "updated their availability" notices (at most once per person per hour), optional voting and session reminders (2 hours, 1 day or 2 days before), and the finalize and cancel announcements. A Telegram group is connected only by sending the command \`/connect <slug> <code>\` shown on the event's manage page; pasting the event link connects nothing. Discord is connected by adding the bot from the manage page and picking a channel within an hour. Linked users can turn off bot direct messages from My Events.

**Data Retention**: On the hosted site, events are deleted one day after they end (a campaign one day after its last session), drafts one day after their last proposed time, and cancelled events one day after cancellation. No third-party analytics run on the hosted site.

## API for Integrations

- \`POST /api/event\` creates an event: title up to 120 characters, description up to 2000, 1 to 500 slots (each \`startTime\` before \`endTime\`), minPlayers 1 to 100, maxPlayers empty or at least minPlayers, a real IANA timezone. The response includes the slug and the admin token.
- Event admin routes accept the admin token as \`Authorization: Bearer <adminToken>\` (or \`x-admin-token\`). Non-admin callers get 403. Errors are JSON \`{ "error", "code" }\`.
- Pass a \`fromUrl\` (public \`https\` only) at creation to receive \`CREATED\`, \`FINALIZED\` and \`CANCELLED\` webhooks. Each delivery carries \`X-Tabletop-Signature\` (sha256 HMAC of the raw body), \`X-Tabletop-Event-Id\` and \`X-Webhook-Id\`; failures are retried with backoff and marked failed after 12 attempts.
- Full reference: https://github.com/mels0n/tabletop_scheduler/blob/main/docs/reference/ApiReference.md

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

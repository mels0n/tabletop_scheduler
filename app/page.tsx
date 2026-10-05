import Link from "next/link";
import { Copy, PlusCircle, ArrowRight, MessageCircle, ShieldCheck, Swords, Layers, Dices } from "lucide-react";
import { SchemaGenerator } from "@/shared/lib/aeo";
import { getDonations } from "@/entities/donation";
import { getEventStats } from "@/shared/lib/event-stats";
import DonationTicker from "@/components/DonationTicker";
import { FaqJsonLd } from "@/components/FaqJsonLd";
import { publicConfig } from "@/shared/config/public";

const HOME_FAQ = [
  {
    question: "Is there a free app to schedule D&D sessions?",
    answer: "Yes. Tabletop Time is a completely free D&D session scheduler and RPG game night planner built specifically for tabletop groups. There are no subscriptions, no premium tiers, and no ads. You create an event, share a link with your players, and the tool automatically finds the best time slot where your required number of players are all available. It works for D&D, Pathfinder, Call of Cthulhu, and any other tabletop RPG.",
  },
  {
    question: "Do my players need to create an account to respond?",
    answer: "No. Tabletop Time is a no-login, no-app scheduling tool. Your players simply click the link you share and select the times they are available. There is no account to create, no email required, and no friction. Anyone can optionally link Telegram or Discord to see their events on every device, but it is never required for players to participate.",
  },
  {
    question: "How is Tabletop Time different from Doodle or When2Meet?",
    answer: "Unlike generic scheduling tools, Tabletop Time is built specifically for tabletop gaming groups. It supports quorum-based scheduling, which means you can set a minimum number of players required to run a session, and the tool finds the best slot where that quorum is met, even if not everyone can make it. It also integrates directly with Discord and Telegram for automatic reminders and poll results, which generic tools don't offer.",
  },
  {
    question: "Does Tabletop Time work for Magic: The Gathering and board game nights?",
    answer: "Yes. While Tabletop Time was built with D&D groups in mind, it works equally well for Magic: The Gathering Commander pods, Draft nights, and board game sessions. The quorum feature is especially useful for MTG, since you can set the exact pod size you need (such as 4 players for Commander) and the tool will find the time slot that works for that many people.",
  },
  {
    question: "Does Tabletop Time integrate with Discord?",
    answer: "Yes. Tabletop Time offers an optional Discord bot integration. Once connected to your Discord server, the bot delivers instant poll results and session reminders directly in your channels, so your group never misses a game night. There is also an optional Telegram bot for groups that coordinate there instead.",
  },
];

export const revalidate = 43200; // 12 hours


/**
 * @component Home
 * @description The primary landing page for the application.
 * Adapts its UI based on the deployment environment (Hosted vs. Self-Hosted)
 * via the `NEXT_PUBLIC_IS_HOSTED` environment variable.
 *
 * @returns {JSX.Element} The rendered landing page.
 */
export default async function Home() {
  // Intent: Determine deployment mode to toggle text/features (e.g., "Free & Open" vs "Self Hosted").
  const isHosted = publicConfig.isHosted;

  // Fetch public donations for the ticker and live event stats for badges in parallel, only in hosted mode.
  const [donations, eventStats] = await Promise.all([
    isHosted ? getDonations(20) : Promise.resolve([]),
    isHosted ? getEventStats() : Promise.resolve(null),
  ]);

  /**
   * @constant jsonLd
   * @description Structured data for SEO, defining the application as a SoftwareApplication.
   * Helps search engines understand the product context.
   */
  const jsonLd = SchemaGenerator.softwareApp({
    name: "Tabletop Time",
    applicationCategory: "GameApplication",
    description: "Coordinate D&D and board game sessions without the chaos.",
    featureList: [
      "Frictionless Voting",
      "No Login Required",
      "Smart Resolution",
      "Telegram Integration",
      "Discord Integration",
      "Free & Open",
      "Privacy First"
    ],
    price: "0.00",
    currency: "USD",
    disambiguatingDescription: "Independent open-source tool, not affiliated with Tabletop Time YouTube channel.",
    // Donation-based reviews for AEO schema (ADR-002/003).
    // Only donations with messages become Schema.org Reviews.
    reviews: donations
      .filter((d): d is typeof d & { message: string } => d.message !== null)
      .map(d => ({ name: d.name, message: d.message, date: d.date })),
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 pt-12 pb-24 md:pt-16 md:pb-32 text-parchment">
      {/* Intent: Inject JSON-LD only in hosted mode to boost SEO for the public instance */}
      {isHosted && (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          <FaqJsonLd data={HOME_FAQ} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebSite",
                "@id": "https://tabletoptime.us/#website",
                "url": "https://tabletoptime.us",
                "name": "Tabletop Time",
                "potentialAction": {
                  "@type": "SearchAction",
                  "target": {
                    "@type": "EntryPoint",
                    "urlTemplate": "https://tabletoptime.us/blog?q={search_term_string}"
                  },
                  "query-input": "required name=search_term_string"
                }
              })
            }}
          />
        </>
      )}
      <div className="relative flex flex-col place-items-center text-center w-full min-w-0 max-w-5xl mx-auto">
        {/* Hero Section */}
        <div className="ornament mb-8" aria-hidden="true">✦</div>
        <h1 className="font-display text-5xl md:text-7xl font-bold text-parchment pb-2">
          Tabletop Time
        </h1>
        <h2 className="text-xl md:text-2xl text-parchment-2 mt-5 font-medium max-w-2xl">
          Free Session Scheduler: the privacy-first way to plan your D&D, RPG, MTG, and board game sessions.
        </h2>
        <p className="mt-6 max-w-2xl text-mist text-lg md:text-xl leading-relaxed">
          {`The "When are we playing?" dance is over. Coordinate your Tabletop gaming without group chat chaos.`}
        </p>


        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <Link
            href="/new"
            className="btn-primary px-8 py-4"
          >
            <PlusCircle className="w-5 h-5" aria-hidden="true" />
            Start Scheduling
          </Link>
          {' '}
          <a
            href="https://github.com/mels0n/tabletop_scheduler"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary px-8 py-4"
          >
            GitHub
          </a>
        </div>

        {/* Donation ticker: compact scrolling social proof strip (ADR-003) */}
        {isHosted && donations.length > 0 && (
          <div className="mt-12 w-full min-w-0">
            <DonationTicker donations={donations} />
          </div>
        )}
      </div>

      {/* Live Event Stats Badges: social proof for hosted version */}
      {isHosted && eventStats && (
        <div className="mt-16 flex flex-col items-center gap-4 w-full max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-line border border-line rounded-card bg-surface w-full">
            <div className="flex flex-col items-center gap-1 px-6 py-5">
              <span className="font-display text-3xl font-bold text-parchment tabular-nums">
                {eventStats.totalEvents.toLocaleString()}
              </span>
              <span className="text-mist text-sm font-medium">Events Active</span>
            </div>
            <div className="flex flex-col items-center gap-1 px-6 py-5">
              <span className="font-display text-3xl font-bold text-parchment tabular-nums">
                {eventStats.activeEvents}
              </span>
              <span className="text-mist text-sm font-medium">Voting Open</span>
            </div>
            <div className="flex flex-col items-center gap-1 px-6 py-5">
              <span className="font-display text-3xl font-bold text-parchment tabular-nums">
                {eventStats.totalParticipants.toLocaleString()}
              </span>
              <span className="text-mist text-sm font-medium">Players Active</span>
            </div>
            <div className="flex flex-col items-center gap-1 px-6 py-5">
              <span className="font-display text-3xl font-bold text-parchment tabular-nums">
                {eventStats.finalizedEvents}
              </span>
              <span className="text-mist text-sm font-medium">Games Locked In</span>
            </div>
          </div>
          <p className="text-xs text-mist text-center max-w-lg mt-2">
            * Stats refresh every 12 hours and reflect the currently active community. We automatically delete expired events for your privacy.
          </p>
        </div>
      )}

      {isHosted && (
        <>
          {/* Supported Games Section */}
          <section className="mt-24 max-w-7xl mx-auto text-center px-4 w-full">
            <h2 className="text-3xl md:text-4xl font-bold text-parchment mb-6">Built for Every Tabletop Experience</h2>
            <p className="text-mist mb-16 max-w-2xl mx-auto text-lg leading-relaxed">
              Whether you are crawling dungeons, tapping mana, or trading resources, we handle the logistics.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              {/* For D&D Groups */}
              <div className="card-accent p-8">
                <h3 className="font-display text-xl font-bold text-parchment mb-4 flex items-center gap-3">
                  <span className="icon-tile" aria-hidden="true"><Swords className="w-5 h-5" /></span> For D&D & RPG Groups
                </h3>
                <p className="text-parchment-2 text-sm leading-7 mb-6">
                  Keep your campaign alive. Perfect for <strong>Dungeons & Dragons 5e</strong>, <strong>Pathfinder</strong>, and <strong>Call of Cthulhu</strong>. Support for Quorums means you play even if the Bard is busy.
                </p>
                <ul className="text-sm text-gold-bright space-y-3 font-medium">
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-gold" data-dot /> Minimum player counts</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-gold" data-dot /> Campaign continuity</li>
                </ul>
              </div>

              {/* For MTG Players */}
              <div className="card-accent p-8">
                <h3 className="font-display text-xl font-bold text-parchment mb-4 flex items-center gap-3">
                  <span className="icon-tile" aria-hidden="true"><Layers className="w-5 h-5" /></span> For Magic: The Gathering
                </h3>
                <p className="text-parchment-2 text-sm leading-7 mb-6">
                  The only scheduler optimized for <strong>Commander (EDH) pods</strong> and <strong>Draft nights</strong>. Find the exact 4-hour block where your whole pod can throw down.
                </p>
                <ul className="text-sm text-gold-bright space-y-3 font-medium">
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-gold" data-dot /> 4-player pod alignment</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-gold" data-dot /> Draft night organization</li>
                </ul>
              </div>

              {/* For Board Gamers */}
              <div className="card-accent p-8">
                <h3 className="font-display text-xl font-bold text-parchment mb-4 flex items-center gap-3">
                  <span className="icon-tile" aria-hidden="true"><Dices className="w-5 h-5" /></span> For Board Gamers
                </h3>
                <p className="text-parchment-2 text-sm leading-7 mb-6">
                  From heavy Euros like <strong>Gloomhaven</strong> to party games. Stop guessing who&apos;s free for board game night. Send one link, get one answer.
                </p>
                <ul className="text-sm text-gold-bright space-y-3 font-medium">
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-gold" data-dot /> Table size management</li>
                  <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-gold" data-dot /> Game night planning</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="mt-24 w-full max-w-5xl text-center space-y-12">
            <h2 className="text-3xl md:text-5xl font-bold text-parchment">Why Gamers Choose Tabletop Time</h2>
            <div className="text-parchment-2 leading-loose space-y-8 text-lg md:text-xl">
              <p>
                We&apos;ve all been there. You have a level 5 party ready to slay the dragon, but you can&apos;t defeat the true final boss: <strong>Scheduling</strong>.
                Group chats become a mess of &quot;I can do Tuesday&quot; and &quot;Wait, I thought we said Thursday?&quot;.
              </p>
              <p>
                Tabletop Time is built specifically for <strong>RPG groups, Magic: The Gathering pods, and Board Game nights</strong>.
                Unlike generic calendar tools, we focus on finding the <em>overlapping availability</em> for your specific quorum.
                Whether you are planning a one-shot or a multi-year campaign, we make the logistics invisible so you can focus on the game.
              </p>
            </div>
            {/* New CTA for How It Works */}
            <div className="mt-12 text-center">
              <Link href="/how-it-works" className="text-gold hover:text-gold-bright font-semibold inline-flex items-center gap-2 group text-lg transition-colors">
                See exactly how it works <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </Link>
            </div>
          </section>
        </>
      )}

      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl text-left w-full">
        <FeatureCard
          icon={<Copy className="w-6 h-6 text-gold-bright" />}
          title={isHosted ? "Frictionless Voting" : "No Login Required"}
          desc={isHosted
            ? "No logins. No apps. Just a link. Your players simply click the times they are free, and we do the rest."
            : "Send a link. Your players vote. No accounts needed."
          }
        />
        <FeatureCard
          icon={<ArrowRight className="w-6 h-6 text-gold-bright" />}
          title="Smart Resolution"
          desc="We automatically find the best slot where everyone can play, or at least your required quorum."
        />
        <FeatureCard
          icon={<MessageCircle className="w-6 h-6 text-telegram" />}
          title="Telegram Integration"
          desc="Optional: Bind a Telegram bot to your group to get instant poll results and reminders where you chat."
        />
        <FeatureCard
          icon={
            <svg className="w-6 h-6 fill-current text-discord" viewBox="0 0 127 96"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22c.63-23.28-18.68-47.5-35.3-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,54,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.23,53,91.1,65.69,84.69,65.69Z" /></svg>
          }
          title="Discord Integration"
          desc="Optional: Bind a Discord bot to your server to get instant poll results and reminders in your channel."
        />
        <FeatureCard
          icon={<PlusCircle className="w-6 h-6 text-gold-bright" />}
          title={isHosted ? "Free & Open" : "Self Hosted"}
          desc={isHosted
            ? "We host this for free for the community. Use it as much as you want."
            : "Your data stays with you. Open source and privacy first."
          }
        />
        {isHosted && (
          <FeatureCard
            icon={<ShieldCheck className="w-6 h-6 text-gold-bright" />}
            title="Privacy First"
            desc="We don't mine your data or sell it to advertisers. We just want you to play more games."
          />
        )}
      </div>
    </div>
  );
}

/**
 * @component FeatureCard
 * @description A stateless presentational component for displaying feature highlights.
 * Tome card with gold top rule.
 *
 * @param {Object} props - The component props.
 * @param {React.ReactNode} props.icon - The icon element to display.
 * @param {string} props.title - The title of the feature.
 * @param {string} props.desc - The description text of the feature.
 * @returns {JSX.Element} A specific feature card UI.
 */
function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="card-accent">
      <div className="icon-tile mb-4" aria-hidden="true">{icon}</div>
      <h2 className="mb-3 font-display font-bold text-parchment text-xl">{title}</h2>
      <p className="text-sm text-parchment-2 leading-relaxed">{desc}</p>
    </div>
  )
}

import Link from "next/link";
import { Copy, PlusCircle, ArrowRight, MessageCircle, ShieldCheck } from "lucide-react";


/**
 * @component Home
 * @description The primary landing page for the application.
 * Adapts its UI based on the deployment environment (Hosted vs. Self-Hosted)
 * via the `NEXT_PUBLIC_IS_HOSTED` environment variable.
 *
 * @returns {JSX.Element} The rendered landing page.
 */
export default function Home() {
  // Intent: Determine deployment mode to toggle text/features (e.g., "Free & Open" vs "Self Hosted").
  const isHosted = process.env.NEXT_PUBLIC_IS_HOSTED === "true";

  /**
   * @constant jsonLd
   * @description Structured data for SEO, defining the application as a SoftwareApplication.
   * Helps search engines understand the product context.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "name": "Tabletop Scheduler",
        "applicationCategory": "GameApplication",
        "operatingSystem": "Web",
        "offers": {
          "@type": "Offer",
          "price": "0.00",
          "priceCurrency": "USD"
        },
        "description": "Coordinate D&D and board game sessions without the chaos.",
        "featureList": [
          "Frictionless Voting",
          "No Login Required",
          "Smart Resolution",
          "Telegram Integration",
          "Discord Integration",
          "Free & Open",
          "Privacy First"
        ]
      }
    ]
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-slate-50">
      {/* Intent: Inject JSON-LD only in hosted mode to boost SEO for the public instance */}
      {isHosted && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <div className="relative flex flex-col place-items-center text-center">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-6xl md:text-7xl bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
          Tabletop Time
          <br className="hidden md:block" />
          <span className="text-2xl md:text-5xl text-slate-200 block mt-4 font-extrabold tracking-tight">
            Free D&D Session Scheduler <br className="md:hidden" />& RPG Game Night Planner
          </span>
          {isHosted && <span className="sr-only">: The Ultimate Game Night Session Scheduler</span>}
        </h1>
        <p className="mt-4 max-w-[600px] text-zinc-400 md:text-xl">
          {isHosted
            ? "The \"When are we playing?\" dance is over. Coordinate your D&D sessions, board game nights, and RPG campaigns without the group chat chaos."
            : "Coordinate your D&D sessions, board game nights, and RPG campaigns without the group chat chaos."
          }
        </p>


        <div className="mt-8 flex gap-4">
          <Link
            href="/new"
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold transition-all shadow-lg shadow-indigo-500/20"
          >
            <PlusCircle className="w-5 h-5" />
            Start Scheduling
          </Link>
          {' '}
          <a
            href="https://github.com/mels0n/tabletop_scheduler"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 font-semibold transition-all border border-slate-700"
          >
            GitHub
          </a>
        </div>


      </div>

      {isHosted && (
        <>
          {/* Supported Games Section */}
          <section className="mt-28 max-w-6xl mx-auto text-center px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-indigo-100 mb-6">Built for Every Tabletop Experience</h2>
            <p className="text-slate-400 mb-12 max-w-2xl mx-auto text-lg">
              Whether you are crawling dungeons, tapping mana, or trading resources, we handle the logistics.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              {/* For D&D Groups */}
              <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/50 transition-colors">
                <h3 className="text-xl font-bold text-slate-100 mb-3 flex items-center gap-2">
                  <span role="img" aria-label="Dragon icon">🐉</span> For D&D & RPG Groups
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  Keep your campaign alive. Perfect for <strong>Dungeons & Dragons 5e</strong>, <strong>Pathfinder</strong>, and <strong>Call of Cthulhu</strong>. Support for Quorums means you play even if the Bard is busy.
                </p>
                <ul className="text-sm text-indigo-300 space-y-2">
                  <li>• Minimum player counts</li> <li>• Campaign continuity tracking</li>
                </ul>
              </div>

              {/* For MTG Players */}
              <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/50 transition-colors">
                <h3 className="text-xl font-bold text-slate-100 mb-3 flex items-center gap-2">
                  <span role="img" aria-label="Cards icon">🃏</span> For Magic: The Gathering
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  The only scheduler optimized for <strong>Commander (EDH) pods</strong> and <strong>Draft nights</strong>. Find the exact 4-hour block where your whole pod can throw down.
                </p>
                <ul className="text-sm text-indigo-300 space-y-2">
                  <li>• 4-player pod alignment</li> <li>• Draft night organization</li>
                </ul>
              </div>

              {/* For Board Gamers */}
              <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/50 transition-colors">
                <h3 className="text-xl font-bold text-slate-100 mb-3 flex items-center gap-2">
                  <span role="img" aria-label="Dice icon">🎲</span> For Board Gamers
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  From heavy Euros like <strong>Gloomhaven</strong> to party games. Stop guessing who&apos;s free for board game night. Send one link, get one answer.
                </p>
                <ul className="text-sm text-indigo-300 space-y-2">
                  <li>• Table size management</li> <li>• Game night planning</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="mt-24 max-w-4xl text-center space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold text-indigo-100">Why Gamers Choose Tabletop Time</h2>
            <div className="text-slate-300 leading-relaxed space-y-4 text-lg">
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
            <div className="mt-8 text-center">
              <Link href="/how-it-works" className="text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-2 group">
                See exactly how it works <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </section>
        </>
      )}

      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl text-left">
        <FeatureCard
          icon={<Copy className="w-6 h-6 text-indigo-400" />}
          title={isHosted ? "Frictionless Voting" : "No Login Required"}
          desc={isHosted
            ? "No logins. No apps. Just a link. Your players simply click the times they are free, and we do the rest."
            : "Send a link. Your players vote. No accounts needed."
          }
        />
        <FeatureCard
          icon={<ArrowRight className="w-6 h-6 text-indigo-400" />}
          title="Smart Resolution"
          desc="We automatically find the best slot where everyone—or just your required quorum—can play."
        />
        <FeatureCard
          icon={<MessageCircle className="w-6 h-6 text-sky-400" />}
          title="Telegram Integration"
          desc="Optional: Bind a Telegram bot to your group to get instant poll results and reminders where you chat."
        />
        <FeatureCard
          icon={
            <svg className="w-6 h-6 fill-current text-[#5865F2]" viewBox="0 0 127 96"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22c.63-23.28-18.68-47.5-35.3-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,54,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.23,53,91.1,65.69,84.69,65.69Z" /></svg>
          }
          title="Discord Integration"
          desc="Optional: Bind a Discord bot to your server to get instant poll results and reminders in your channel."
        />
        <FeatureCard
          icon={<PlusCircle className="w-6 h-6 text-indigo-400" />}
          title={isHosted ? "Free & Open" : "Self Hosted"}
          desc={isHosted
            ? "We host this for free for the community. Use it as much as you want."
            : "Your data stays with you. Open source and privacy first."
          }
        />
        {isHosted && (
          <FeatureCard
            icon={<ShieldCheck className="w-6 h-6 text-indigo-400" />}
            title="Privacy First"
            desc="We delete old event data every 24 hours. We don't want your data, and we don't keep it."
          />
        )}
      </div>
    </main>
  );
}

/**
 * @component FeatureCard
 * @description A stateless presentational component for displaying feature highlights.
 *
 * @param {Object} props - The component props.
 * @param {React.ReactNode} props.icon - The icon element to display.
 * @param {string} props.title - The title of the feature.
 * @param {string} props.desc - The description text of the feature.
 * @returns {JSX.Element} A specific feature card UI.
 */
function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="group rounded-lg border border-slate-800 bg-slate-900/50 p-5 hover:border-indigo-500/50 transition-colors">
      <div className="mb-3">{icon}</div>
      <h2 className="mb-2 font-semibold text-slate-200">{title}</h2>
      <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
    </div>
  )
}

import Link from "next/link";
import { Copy, PlusCircle, ArrowRight, MessageCircle, ShieldCheck } from "lucide-react";
import { FAQItem } from "@/components/FAQItem";
import { FaqJsonLd } from "@/components/FaqJsonLd";


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
    "@type": "SoftwareApplication",
    "name": "Tabletop Scheduler",
    "applicationCategory": "UtilitiesApplication",
    "operatingSystem": "Web Browser",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "description": "Coordinate D&D and board game sessions without the chaos.",
    "featureList": [
      "Frictionless Voting",
      "No Login Required",
      "Smart Resolution",
      "Telegram Integration",
      "Free & Open",
      "Privacy First"
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
          {isHosted && <span className="sr-only">: The Ultimate Game Night Session Scheduler</span>}
        </h1>
        <p className="mt-4 max-w-[600px] text-zinc-400 md:text-xl">
          {isHosted
            ? "The \"When are we playing?\" dance is over. Coordinate your D&D sessions, board game nights, and RPG campaigns without the group chat chaos."
            : "Coordinate your D&D sessions, board game nights, and RPG campaigns without the group chat chaos."
          }
        </p>

        {isHosted && (
          <div className="mt-6 max-w-2xl text-sm text-slate-500">
            <p>
              Stop fighting with Doodle polls. Tabletop Time is the <strong>privacy-first</strong>, <strong>login-free</strong> scheduler built specifically for gamers.
              Whether you play D&D, Pathfinder, or Board Games, find a time that works for everyone.
            </p>
          </div>
        )}

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
          icon={<MessageCircle className="w-6 h-6 text-indigo-400" />}
          title="Telegram Integration"
          desc="Optional: Bind a Telegram bot to your group to get instant poll results and reminders where you chat."
        />
        <FeatureCard
          icon={<PlusCircle className="w-6 h-6 text-indigo-400" />}
          title={isHosted ? "Free & Open" : "Self Hosted"}
          desc={isHosted
            ? "We host this for free for the community. Use it as much as you want. Supported by unobtrusive ads."
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

      {isHosted && (
        <>
          <div className="mt-20 max-w-4xl w-full">
            <h2 className="text-2xl font-bold mb-6 text-center text-indigo-400">Frequently Asked Questions</h2>
            <div className="space-y-4">
              <FAQItem
                question="Is Tabletop Time free?"
                answer="Yes, it is free and open source. We believe in tools that serve the community without paywalls."
              />
              <FAQItem
                question="Do players need an account to vote?"
                answer="No. Players can click the link you send and vote immediately. No login required."
              />
            </div>
          </div>

          {/* Intent: Answer Engine Optimization (AEO) Schema */}
          <FaqJsonLd data={[
            { question: "Is Tabletop Time free?", answer: "Yes, it is free and open source. We believe in tools that serve the community without paywalls." },
            { question: "Do players need an account to vote?", answer: "No. Players can click the link you send and vote immediately. No login required." }
          ]} />
        </>
      )}

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

import type { DonorComment } from '@/lib/donations';

/**
 * @component DonationTicker
 * @description CSS-only infinite-scrolling ticker tape displaying donor messages.
 * Placed between the CTA buttons and the "Built for Every Tabletop Experience" section.
 * The entire ticker is a clickable link to the Ko-fi page.
 *
 * Design: No header. Compact single-row marquee (~48px). Gradient edge fades.
 * Behavior: Seamless CSS loop, pauses on hover.
 *
 * @see ADR-003 in DECISIONS.md for design rationale.
 */

const KOFI_URL = 'https://ko-fi.com/N4N11VDWCU';

/**
 * Derives coffee emoji string from coffee count.
 * Shows individual ☕ up to 5, then "☕×N" for larger amounts.
 */
function coffeeEmojis(count: number): string {
  if (count <= 5) return '☕'.repeat(count);
  return '☕'.repeat(5) + '+';
}

/**
 * Truncates a message to a reasonable length for the ticker chip.
 * Ensures long donor messages don't break the compact layout.
 */
function truncate(text: string, maxLength = 60): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trimEnd() + '…';
}

interface DonationTickerProps {
  donations: DonorComment[];
}

export default function DonationTicker({ donations }: DonationTickerProps) {
  if (donations.length === 0) return null;

  // Render chips once, duplicate the set for seamless CSS loop
  const chips = donations.map((d, i) => (
    <span
      key={i}
      className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/[0.05] border border-white/10 rounded-full text-xs whitespace-nowrap flex-shrink-0"
    >
      <strong className="text-slate-200 font-semibold">{d.name}</strong>
      {d.message && (
        <em className="text-slate-400 font-normal">— &ldquo;{truncate(d.message)}&rdquo;</em>
      )}
      <span className="text-amber-400" aria-label={`${d.coffees} coffees`}>
        {coffeeEmojis(d.coffees)}
      </span>
    </span>
  ));

  return (
    <a
      href={KOFI_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="block ticker-wrapper relative overflow-hidden py-2 cursor-pointer group"
      aria-label="Support Tabletop Time on Ko-fi"
    >
      {/* Gradient fade — left edge */}
      <div
        className="absolute left-0 top-0 bottom-0 w-16 md:w-24 z-10 pointer-events-none"
        style={{
          background: 'linear-gradient(to right, rgb(15 23 42) 0%, transparent 100%)',
        }}
      />

      {/* Scrolling track — two copies for seamless loop */}
      <div className="ticker-track inline-flex gap-4 group-hover:[animation-play-state:paused]">
        {chips}
        {/* Duplicate for seamless wrap-around */}
        {chips.map((chip, i) => (
          <span key={`dup-${i}`} aria-hidden="true">
            {chip}
          </span>
        ))}
      </div>

      {/* Gradient fade — right edge */}
      <div
        className="absolute right-0 top-0 bottom-0 w-16 md:w-24 z-10 pointer-events-none"
        style={{
          background: 'linear-gradient(to left, rgb(15 23 42) 0%, transparent 100%)',
        }}
      />
    </a>
  );
}

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
 * Renders cross-platform SVG coffee cups instead of native emojis
 * (Windows native emoji for coffee is famously hard to read).
 */
function CoffeeIcons({ count }: { count: number }) {
  const displayCount = Math.min(count, 5);
  const showPlus = count > 5;
  
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" aria-label={`${count} coffees`}>
      {Array.from({ length: displayCount }).map((_, i) => (
        <svg key={i} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
          <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
          <line x1="6" x2="6" y1="2" y2="4"/>
          <line x1="10" x2="10" y1="2" y2="4"/>
          <line x1="14" x2="14" y1="2" y2="4"/>
        </svg>
      ))}
      {showPlus && <span className="text-xs font-bold leading-none ml-0.5">+</span>}
    </span>
  );
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

  // Ensure one "set" always overflows the viewport so the -50% loop is seamless.
  // With few donations the chips may be narrower than the screen, causing a visible
  // gap before the duplicate set appears. Repeating until we have ≥6 chips prevents this.
  const minRepeat = Math.max(1, Math.ceil(6 / donations.length));
  const paddedDonations = Array.from({ length: minRepeat }, () => donations).flat();

  // Render chips once, duplicate the set for seamless CSS loop
  const chips = paddedDonations.map((d, i) => (
    <span
      key={i}
      className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/[0.05] border border-white/10 rounded-full text-xs whitespace-nowrap flex-shrink-0"
    >
      <strong className="text-slate-200 font-semibold">{d.name}</strong>
      {d.message && (
        <em className="text-slate-400 font-normal">— &ldquo;{truncate(d.message)}&rdquo;</em>
      )}
      <CoffeeIcons count={d.coffees} />
    </span>
  ));

  return (
    <a
      href={KOFI_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full min-w-0 ticker-wrapper relative overflow-hidden py-2 cursor-pointer group"
      aria-label="Support Tabletop Time on Ko-fi"
    >
      {/* Gradient fade — left edge */}
      <div
        className="absolute left-0 top-0 bottom-0 w-16 md:w-24 z-10 pointer-events-none"
        style={{
          background: 'linear-gradient(to right, rgb(15 23 42) 0%, transparent 100%)',
        }}
      />

      {/* Scrolling track — two copies for seamless loop.
          Duration scales with chip count to keep a consistent ~7s-per-chip pace. */}
      <div
        className="ticker-track inline-flex gap-4 group-hover:[animation-play-state:paused]"
        style={{ '--ticker-duration': `${paddedDonations.length * 7}s` } as React.CSSProperties}
      >
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

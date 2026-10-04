import prisma from '@/shared/lib/prisma';
import Logger from '@/shared/lib/logger';

const log = Logger.get('Donations');

/**
 * Public-safe DTO for rendering donation social proof.
 * Intentionally excludes email and raw payload — privacy by design.
 */
export interface DonorComment {
  name: string;
  coffees: number;       // Derived: ceil(amountCents / 300); Ko-fi uses $3/coffee
  message: string | null;
  date: string;          // ISO string for rendering or schema generation
}

/** Ko-fi prices a coffee at $3. */
const CENTS_PER_COFFEE = 300;

/**
 * Parses a Ko-fi amount string ("5.00", "3", "1,000.50") into integer cents.
 * Returns null for anything that is not a finite, non-negative number.
 */
export function parseAmountToCents(amount: string | null | undefined): number | null {
  if (typeof amount !== 'string') return null;
  const normalized = amount.trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Coffees for display; an unparseable amount counts as zero instead of poisoning totals with NaN. */
function coffeesFor(amount: string): number {
  const cents = parseAmountToCents(amount);
  return cents === null ? 0 : Math.ceil(cents / CENTS_PER_COFFEE);
}

export interface DonationStats {
  totalSupporters: number;
  totalCoffees: number;
}

/**
 * Fetches public donations for UI display.
 * Only returns records where `isPublic === true` — supporters who opted into visibility.
 *
 * @param limit Maximum number of donations to return (default 20).
 * @returns Typed DonorComment array, newest first. Returns [] on failure.
 */
export async function getDonations(limit = 20): Promise<DonorComment[]> {
  try {
    const records = await prisma.donation.findMany({
      where: { isPublic: true },
      orderBy: { donatedAt: 'desc' },
      take: limit,
      select: {
        fromName: true,
        amount: true,
        message: true,
        donatedAt: true,
      },
    });

    return records.map((r) => ({
      name: r.fromName,
      coffees: coffeesFor(r.amount),
      message: r.message,
      date: r.donatedAt.toISOString(),
    }));
  } catch (error) {
    log.error('Failed to fetch donations', error as Error);
    return [];
  }
}

/**
 * Aggregates public donation statistics for social proof badges.
 *
 * @returns Total supporter count and total coffee count. Returns zeroes on failure.
 */
export async function getDonationStats(): Promise<DonationStats> {
  try {
    const records = await prisma.donation.findMany({
      where: { isPublic: true },
      select: { amount: true },
    });

    const totalSupporters = records.length;
    const totalCoffees = records.reduce(
      (sum, r) => sum + coffeesFor(r.amount),
      0
    );

    return { totalSupporters, totalCoffees };
  } catch (error) {
    log.error('Failed to fetch donation stats', error as Error);
    return { totalSupporters: 0, totalCoffees: 0 };
  }
}

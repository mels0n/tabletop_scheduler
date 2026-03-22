import prisma from '@/shared/lib/prisma';

/**
 * Public-safe DTO for rendering donation social proof.
 * Intentionally excludes email and raw payload — privacy by design.
 */
export interface DonorComment {
  name: string;
  coffees: number;       // Derived: ceil(parseFloat(amount) / 3) — Ko-fi uses $3/coffee
  message: string | null;
  date: string;          // ISO string for rendering or schema generation
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
      coffees: Math.ceil(parseFloat(r.amount) / 3),
      message: r.message,
      date: r.donatedAt.toISOString(),
    }));
  } catch (error) {
    console.error('[Donations] Failed to fetch donations:', error);
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
      (sum, r) => sum + Math.ceil(parseFloat(r.amount) / 3),
      0
    );

    return { totalSupporters, totalCoffees };
  } catch (error) {
    console.error('[Donations] Failed to fetch donation stats:', error);
    return { totalSupporters: 0, totalCoffees: 0 };
  }
}

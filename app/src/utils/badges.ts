import { BADGES } from '@/theme/badges';

export type BadgeState = (typeof BADGES)[number] & { unlocked: boolean; earned: Date | null; progress: number };

/** Each badge's state from the current streak (and the API's highest badge, if that is higher). */
export function badgeStates(streak: number, apiBadge: string | null | undefined): BadgeState[] {
  const apiIndex = BADGES.findIndex((b) => b.key === apiBadge);
  return BADGES.map((b, i) => {
    const byStreak = streak >= b.nights;
    let earned: Date | null = null;
    if (byStreak) {
      // The night the current streak reached this tier.
      earned = new Date();
      earned.setDate(earned.getDate() - (streak - b.nights));
    }
    return { ...b, unlocked: byStreak || i <= apiIndex, earned, progress: Math.min(streak, b.nights) / b.nights };
  });
}

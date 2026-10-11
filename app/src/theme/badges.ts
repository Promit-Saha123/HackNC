// Streak tiers: 3 / 7 / 14 / 30 nights.
export const BADGES = [
  { key: 'moon', label: 'Moon', nights: 3 },
  { key: 'cloud', label: 'Cloud', nights: 7 },
  { key: 'rainbow', label: 'Rainbow', nights: 14 },
  { key: 'aurora', label: 'Aurora', nights: 30 },
] as const;

export type BadgeKey = (typeof BADGES)[number]['key'];

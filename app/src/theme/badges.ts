// Streak tiers: 3 / 7 / 14 / 30 nights.
export const BADGES = [
  { key: 'moon', label: 'Moon', nights: 3, blurb: 'Your first real streak. Three good nights in a row.' },
  { key: 'cloud', label: 'Cloud', nights: 7, blurb: 'A full week of steady sleep. This is where habits start.' },
  { key: 'rainbow', label: 'Rainbow', nights: 14, blurb: 'Two weeks straight. Your streak now gives you full streak points.' },
  { key: 'aurora', label: 'Aurora', nights: 30, blurb: 'A month of consistent sleep. The rarest badge in the squad.' },
] as const;

export type BadgeKey = (typeof BADGES)[number]['key'];

// Sky theme: white text and translucent glass over the time-of-day scene (see components/Backdrop).
// Surfaces are see-through on purpose so the sky shows through in both day and night.
export const colors = {
  bg: '#0D1A4A',
  edgeGlow: '#13265A',
  card: 'rgba(255,255,255,0.12)',
  cardSheen: 'rgba(255,255,255,0.18)',
  raised: 'rgba(255,255,255,0.16)',
  highlight: 'rgba(255,255,255,0.14)',
  tabBar: '#0D1A4A',
  border: 'rgba(255,255,255,0.24)',
  divider: 'rgba(255,255,255,0.16)',
  /** Opaque sheet fill for phones without Liquid Glass. */
  sheet: '#172C63',

  text: '#FFFFFF',
  textSoft: 'rgba(236,243,255,0.78)',
  tabInactive: 'rgba(236,243,255,0.7)',
  tabActive: '#FFFFFF',

  /** Accent gradient runs accent -> accentEnd (icy cyan to lavender, like the ring). */
  accent: '#A9ECFF',
  accentEnd: '#9C8DFF',
  /** Text and icons drawn on top of the light accent. */
  onAccent: '#0D1A4A',
  avatarStart: '#A9ECFF',
  glow: '#BFE6FF',

  switcherBg: 'rgba(255,255,255,0.1)',
  switcherText: '#0D1A4A',
  dimBar: 'rgba(255,255,255,0.2)',
  ringTrack: 'rgba(255,255,255,0.14)',
  badgeLocked: 'rgba(255,255,255,0.12)',
  backdrop: 'rgba(5,10,35,0.5)',

  excellent: '#FFFFFF',
  moderate: '#A9DCFF',
  low: '#FFB3C8',

  up: '#62F2B4',
  down: '#FF97A8',
  connected: '#62F2B4',
  toggleOn: '#7FD4FF',
  unlockedBg: 'rgba(255,255,255,0.22)',
  unlockedText: '#FFFFFF',
  danger: '#FF8FA0',
} as const;

/** Main accent gradient, cyan to lavender. */
export const gradient = [colors.accent, colors.accentEnd] as const;

export type ScoreBand = 'excellent' | 'moderate' | 'low';

export const scoreBand = (score: number): ScoreBand => (score >= 80 ? 'excellent' : score >= 50 ? 'moderate' : 'low');

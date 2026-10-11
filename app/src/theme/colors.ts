// Deep black + white/gray palette. Color is kept only where it carries meaning (up, connected, danger).
export const colors = {
  bg: '#000000',
  edgeGlow: '#0B0B0C',
  card: '#101011',
  cardSheen: '#18181A',
  raised: '#222224',
  highlight: '#1B1B1D',
  tabBar: '#050505',
  border: '#2A2A2D',
  divider: '#1E1E20',

  text: '#F5F5F5',
  textSoft: '#9B9BA0',
  tabInactive: '#6B6B70',
  tabActive: '#FFFFFF',

  /** Accent gradient runs accent -> accentEnd (white to gray). */
  accent: '#FFFFFF',
  accentEnd: '#8E8E93',
  /** Text and icons drawn on top of the light accent. */
  onAccent: '#000000',
  avatarStart: '#FFFFFF',
  glow: '#FFFFFF',

  switcherBg: '#0E0E0F',
  switcherText: '#000000',
  dimBar: '#2C2C2F',
  ringTrack: '#151517',
  badgeLocked: '#19191B',
  backdrop: 'rgba(0,0,0,0.7)',

  excellent: '#F5F5F5',
  moderate: '#A1A1A6',
  low: '#5A5A5F',

  up: '#4ADE80',
  down: '#FF6B6B',
  connected: '#4ADE80',
  toggleOn: '#F5F5F5',
  unlockedBg: '#2A2A2D',
  unlockedText: '#FFFFFF',
  danger: '#FF5A5F',
} as const;

/** Main accent gradient, white to gray. */
export const gradient = [colors.accent, colors.accentEnd] as const;

export type ScoreBand = 'excellent' | 'moderate' | 'low';

export const scoreBand = (score: number): ScoreBand => (score >= 80 ? 'excellent' : score >= 50 ? 'moderate' : 'low');

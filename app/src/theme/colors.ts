// Dark navy palette from app design & sitemap (docs: "Design system > Colors").
export const colors = {
  bg: '#010D21',
  edgeGlow: '#05142D',
  card: '#041633',
  cardSheen: '#0A1D45',
  raised: '#18274B',
  highlight: '#141F52',
  tabBar: '#010B1F',
  border: '#1D3B7C',
  divider: '#182058',

  text: '#F5F6F7',
  textSoft: '#8B93D6',
  tabInactive: '#718DCF',
  tabActive: '#3B8CFF',

  purple: '#7E44FC',
  blue: '#1476FD',
  avatarStart: '#0FB2FE',

  switcherBg: '#041336',
  switcherText: '#0A1630',
  dimBar: '#253456',
  ringTrack: '#0B1A3A',
  badgeLocked: '#19264A',

  excellent: '#7365FD',
  moderate: '#238EFE',
  low: '#FB4FCE',

  up: '#00D1A5',
  connected: '#1FE191',
  toggleOn: '#775DFD',
  unlockedBg: '#0F3C8F',
  unlockedText: '#38C8FF',
  danger: '#FF4D6A',
} as const;

/** Main accent gradient, purple to blue. */
export const gradient = [colors.purple, colors.blue] as const;

export type ScoreBand = 'excellent' | 'moderate' | 'low';

export const scoreBand = (score: number): ScoreBand => (score >= 80 ? 'excellent' : score >= 50 ? 'moderate' : 'low');

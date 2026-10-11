// Time-of-day sky: everything the scene needs, from a fractional hour (0-24, local time).
// Sunrise/sunset are fixed approximations (no location), good enough for a mood background.

const SUNRISE = 6.5;
const SUNSET = 19;

type RGB = [number, number, number];

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = ([r, g, b]: RGB) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Blend two #rrggbb colors; t=0 gives a, t=1 gives b. */
export function mix(a: string, b: string, t: number) {
  const x = hex(a);
  const y = hex(b);
  const k = Math.max(0, Math.min(1, t));
  return toHex([x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k]);
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const bell = (x: number, center: number, width: number) => Math.exp(-(((x - center) / width) ** 2));

const NIGHT = { top: '#050A24', mid: '#0D1A4A', horizon: '#1F3470', seaTop: '#12265A', seaBottom: '#040A20' };
const DAY = { top: '#3A8CD6', mid: '#7DBFEB', horizon: '#D3EEFB', seaTop: '#5BAAD8', seaBottom: '#1A69A2' };
const GLOW = { mid: '#B98BC0', horizon: '#F7A878' };

export type Sky = {
  /** 1 in full daylight, 0 at night, smooth in between. */
  daylight: number;
  /** Peaks at sunrise and sunset (orange/pink horizon). */
  twilight: number;
  top: string;
  mid: string;
  horizon: string;
  seaTop: string;
  seaBottom: string;
  /** 0-1 across the sky, or null when below the horizon. `height` is 0 at the horizon, 1 at the top of its arc. */
  sun: { x: number; height: number; color: string } | null;
  moon: { x: number; height: number } | null;
};

/** Position along an arc from `rise` to `set` (hours, may pass midnight). */
function arc(h: number, rise: number, set: number) {
  const span = set - rise;
  const p = (h - rise) / span;
  if (p < 0 || p > 1) return null;
  return { x: 0.1 + 0.8 * p, height: Math.sin(Math.PI * p) };
}

export function skyAt(hour: number): Sky {
  const h = ((hour % 24) + 24) % 24;
  const daylight = smoothstep(SUNRISE - 0.7, SUNRISE + 0.7, h) * (1 - smoothstep(SUNSET - 0.7, SUNSET + 0.7, h));
  const twilight = Math.max(bell(h, SUNRISE, 0.75), bell(h, SUNSET, 0.75));

  const top = mix(NIGHT.top, DAY.top, daylight);
  const mid = mix(mix(NIGHT.mid, DAY.mid, daylight), GLOW.mid, twilight * 0.45);
  const horizon = mix(mix(NIGHT.horizon, DAY.horizon, daylight), GLOW.horizon, twilight * 0.7);
  const seaTop = mix(mix(NIGHT.seaTop, DAY.seaTop, daylight), '#C98A86', twilight * 0.3);
  const seaBottom = mix(NIGHT.seaBottom, DAY.seaBottom, daylight);

  const s = arc(h, SUNRISE - 0.6, SUNSET + 0.6);
  const sun = s ? { ...s, color: mix('#FFB36B', '#FFF7DC', Math.min(1, s.height * 2.2)) } : null;

  // The moon's night runs past midnight: shift early-morning hours by 24.
  const hn = h < 12 ? h + 24 : h;
  const moon = arc(hn, SUNSET - 0.3, SUNRISE + 24 + 0.3);

  return { daylight, twilight, top, mid, horizon, seaTop, seaBottom, sun, moon };
}

/** Current local time as a fractional hour. */
export const nowHour = (d = new Date()) => d.getHours() + d.getMinutes() / 60;

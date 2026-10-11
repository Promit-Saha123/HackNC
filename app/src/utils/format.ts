/** 522 -> "8h 42m" */
export const hm = (min: number) => `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;

/** "2026-10-10" -> "Sat" (noon avoids timezone day shifts). */
export const weekday = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' });

/** ISO date-time -> "10:45 pm" */
export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(' PM', ' pm').replace(' AM', ' am');

/** "Sunday, May 25" */
export const longDate = (d = new Date()) =>
  d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

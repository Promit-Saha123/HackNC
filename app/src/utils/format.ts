/** 522 -> "8h 42m" */
export const hm = (min: number) => `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;

/** "2026-10-10" -> "Sat" (noon avoids timezone day shifts). */
export const weekday = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' });

/**
 * Parses an API date-time. The backend sends Python's microseconds (23:00:27.493022), which Hermes may not
 * accept, so the fraction is dropped first. No offset = device-local time, which is what we want.
 */
export const toDate = (iso: string) => new Date(iso.replace(/\.\d+/, ''));

/** ISO date-time -> "10:45 pm" */
export const clock = (iso: string) =>
  toDate(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(' PM', ' pm').replace(' AM', ' am');

/** Minutes after midnight (wraps past 24 h) -> "10:45 pm" */
export const clockFromMinutes = (m: number) => {
  const total = ((Math.round(m) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const min = String(total % 60).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${min} ${h < 12 ? 'am' : 'pm'}`;
};

/** "2026-10-10" -> "Oct 10" */
export const shortDay = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** "Sunday, May 25" */
export const longDate = (d = new Date()) =>
  d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

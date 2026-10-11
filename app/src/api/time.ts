const pad = (n: number) => String(n).padStart(2, '0');

/** Device-local wall-clock ISO without a UTC offset (the format the backend uses and expects). */
export const localIso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

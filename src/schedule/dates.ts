// Day and instant arithmetic for schedules. FORMAT.md §7: a day is
// `YYYY-MM-DD` and means the start of that local day; an instant is
// `YYYY-MM-DDTHH:MM:SSZ`, always UTC.

const pad = (n: number) => String(n).padStart(2, '0');

/** The local calendar day of an instant. */
export function dayOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight at the start of `day`. */
export function dayStart(day: string): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function addDays(day: string, n: number): string {
  const dt = dayStart(day);
  dt.setDate(dt.getDate() + n);
  return dayOf(dt);
}

export function isDay(when: string): boolean {
  return when.length === 10;
}

/** A day or instant from the format, as a Date. */
export function whenToDate(when: string): Date {
  return isDay(when) ? dayStart(when) : new Date(when);
}

/** An instant in the format's UTC form, to the second. */
export function instantOf(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    + `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
}

/** Whole calendar days from `from` to `to`, by UTC date, as ts-fsrs counts them. */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((b - a) / 86_400_000);
}

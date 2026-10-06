// Fixed demo clock. Every overdue / pending state is computed against this
// instant, so the prototype tells the same story whenever it is opened.
// All times are site-local wall-clock times (all demo sites share one zone).

export const DEMO_NOW = '2026-10-13T13:30';
export const TODAY = '2026-10-13';
export const TOMORROW = '2026-10-14';
export const DEMO_DATES = [TODAY, TOMORROW];

/** Compare two local ISO strings (same zone, same format). */
export function isBefore(a: string, b: string): boolean {
  return a < b;
}

export function isPast(at: string | undefined): boolean {
  return !!at && isBefore(at, DEMO_NOW);
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(iso: string) {
  const [d, t] = iso.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, day));
  return { y, m, day, dow: date.getUTCDay(), time: t?.slice(0, 5) };
}

export function fmtDate(iso: string): string {
  const p = parts(iso);
  return `${DAY[p.dow]} ${p.day} ${MON[p.m - 1]}`;
}

export function fmtDateTime(iso: string): string {
  const p = parts(iso);
  const datePart = iso.slice(0, 10);
  const rel = datePart === TODAY ? 'Today' : datePart === TOMORROW ? 'Tomorrow' : fmtDate(iso);
  return p.time ? `${rel} ${p.time}` : rel;
}

export function serviceDateLabel(iso: string): string {
  const rel = iso === TODAY ? ' (today)' : iso === TOMORROW ? ' (tomorrow)' : '';
  return `${fmtDate(iso)} ${parts(iso).y}${rel}`;
}

/** "in 30 min", "2 h 10 min ago" relative to the demo clock. */
export function relativeToNow(at: string): string {
  const toMin = (s: string) => {
    const p = parts(s);
    const [hh, mm] = (p.time ?? '00:00').split(':').map(Number);
    return Date.UTC(p.y, p.m - 1, p.day, hh, mm) / 60000;
  };
  const diff = toMin(at) - toMin(DEMO_NOW);
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const span = h >= 24 ? `${Math.round(h / 24)} d` : h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
  if (diff === 0) return 'now';
  return diff > 0 ? `in ${span}` : `${span} ago`;
}

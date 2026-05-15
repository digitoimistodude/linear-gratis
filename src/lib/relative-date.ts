// Convert a date into a Linear-style relative label. Anything within the past
// week becomes "X minutes ago" / "2 days ago"; further out falls back to a
// Finnish-style absolute date (d.M.yyyy). Always paired with a `title` of the
// full ISO timestamp by the caller via `formatExactDate`.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural} ago`;
}

export function formatRelativeDate(input: string | Date | null | undefined, now: Date = new Date()): string {
  if (!input) return '';
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '';

  const diff = now.getTime() - date.getTime();
  if (diff < 0) return formatExactDate(date);
  if (diff < 30 * SECOND) return 'a moment ago';
  if (diff < MINUTE) return `${Math.floor(diff / SECOND)} seconds ago`;
  if (diff < HOUR) return pluralize(Math.floor(diff / MINUTE), 'minute', 'minutes');
  if (diff < DAY) return pluralize(Math.floor(diff / HOUR), 'hour', 'hours');
  if (diff < WEEK) return pluralize(Math.floor(diff / DAY), 'day', 'days');
  return formatExactDate(date);
}

// Finnish-style short absolute date used both as the fallback for old dates
// and as the title-attribute tooltip on relative labels.
export function formatExactDate(input: string | Date | null | undefined): string {
  if (!input) return '';
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

// Full timestamp (including time) for the `title` attribute on relative labels.
export function formatTooltipDate(input: string | Date | null | undefined): string {
  if (!input) return '';
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '';
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

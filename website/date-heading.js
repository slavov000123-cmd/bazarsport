/**
 * Display-only title formatting for BAZARSPORT public prediction cards.
 * It does not modify the underlying publication, odds, fixtures or audit history.
 * Call this at the existing heading render point AFTER migrating current Sites code.
 */
const DATE_IN_TITLE = /\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/;
const TARGET_CATEGORY = /^(?:elite|quantbet|corner[ _-]?hunter|bet[ _-]?strike)$/i;
const TARGET_LABEL = /\b(?:CORNER\s+HUNTER|BET\s+STRIKE)\b/i;

function validDate(day, month, year) {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month && d.getUTCDate() === day;
}

function fromTitle(title) {
  const m = DATE_IN_TITLE.exec(title ?? '');
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (!validDate(day, month, year)) return null;
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}

function fromDateValue(value) {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('bg-BG', {
    timeZone: 'Europe/Sofia', day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(date);
  const part = (type) => parts.find((p) => p.type === type)?.value;
  return `${part('day')}.${part('month')}.${part('year')}`;
}

/**
 * Use only for the visible large/white headline; keep the green label and match cards intact.
 * For other categories, returns the supplied title unchanged.
 */
export function getPublicPredictionHeading(publication) {
  const title = typeof publication?.title === 'string' ? publication.title : '';
  const category = typeof publication?.category === 'string' ? publication.category : '';
  const isTarget = TARGET_CATEGORY.test(category) || TARGET_LABEL.test(title);
  if (!isTarget) return title;
  return fromTitle(title)
    ?? fromDateValue(publication?.matchDate)
    ?? fromDateValue(publication?.date)
    ?? fromDateValue(publication?.publishedAt)
    ?? 'Дата не е посочена';
}

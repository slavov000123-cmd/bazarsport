import test from 'node:test';
import assert from 'node:assert/strict';
import { getPublicPredictionHeading } from '../website/date-heading.js';

test('CORNER HUNTER: white heading only date; record intact', () => {
  const pub = { title: 'CORNER HUNTER — 21.11.2026 — Манчестър Сити + Леверкузен — 1П W1 @1.9992', category: 'elite' };
  assert.equal(getPublicPredictionHeading(pub), '21.11.2026');
  assert.match(pub.title, /Манчестър/);
});
test('BET STRIKE heading only date', () => {
  assert.equal(getPublicPredictionHeading({ title: 'BET STRIKE — 21.11.2026 — Арсенал + Ливърпул @2.00', category: 'quantbet' }), '21.11.2026');
});
test('recognizes label without category', () => {
  assert.equal(getPublicPredictionHeading({ title: 'BET STRIKE — 9.1.2026 — Fixtures' }), '09.01.2026');
});
test('fallback converts UTC timestamp to Sofia calendar date', () => {
  assert.equal(getPublicPredictionHeading({ title: 'Today picks', category: 'elite', publishedAt: '2026-11-20T22:30:00Z' }), '21.11.2026');
});
test('other types unchanged', () => {
  assert.equal(getPublicPredictionHeading({ title: 'Official announcement', category: 'news' }), 'Official announcement');
});
test('rejects invalid date', () => {
  assert.equal(getPublicPredictionHeading({ title: 'CORNER HUNTER — 31.02.2026', category: 'elite' }), 'Дата не е посочена');
});

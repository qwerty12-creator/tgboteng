import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, diffDays, lastNDates, formatDateKey, weekStartKey, localDate } from '../src/utils/date.js';

test('addDays и diffDays согласованы', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(diffDays('2026-01-01', '2026-01-11'), 10);
});

test('lastNDates возвращает возрастающий список нужной длины', () => {
  const dates = lastNDates(5, '2026-05-10');
  assert.deepEqual(dates, ['2026-05-06', '2026-05-07', '2026-05-08', '2026-05-09', '2026-05-10']);
});

test('weekStartKey всегда понедельник', () => {
  // 2026-05-10 — воскресенье
  assert.equal(weekStartKey('2026-05-10'), '2026-05-04');
  assert.equal(weekStartKey('2026-05-04'), '2026-05-04');
});

test('formatDateKey показывает день и месяц', () => {
  assert.equal(formatDateKey('2026-05-07'), '7 May');
});

test('localDate возвращает YYYY-MM-DD', () => {
  assert.match(localDate(), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(localDate('2026-05-07T10:00:00.000Z'), /^\d{4}-\d{2}-\d{2}$/);
});

import { config } from '../config.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function nowIso() {
  return new Date().toISOString();
}

/** Ключ локальной даты пользователя: YYYY-MM-DD. */
export function localDate(input = new Date()) {
  const ts = input instanceof Date ? input.getTime() : new Date(input).getTime();
  const shifted = new Date(ts + config.tzOffset * 3600 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export function addDays(dateKey, days) {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(fromKey, toKey) {
  const a = Date.parse(`${fromKey}T00:00:00.000Z`);
  const b = Date.parse(`${toKey}T00:00:00.000Z`);
  return Math.round((b - a) / DAY_MS);
}

/** Последние `n` дней, по возрастанию (старые -> новые), последний = endKey. */
export function lastNDates(n, endKey = localDate()) {
  const res = [];
  for (let i = n - 1; i >= 0; i -= 1) res.push(addDays(endKey, -i));
  return res;
}

/** Начало недели (понедельник) для даты. */
export function weekStartKey(dateKey = localDate()) {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = понедельник
  return addDays(dateKey, -dow);
}

export function formatDateKey(dateKey) {
  const [, m, d] = dateKey.split('-');
  return `${Number(d)} ${MONTHS_SHORT[Number(m) - 1]}`;
}

export function formatDateTime(iso) {
  const key = localDate(iso);
  const shifted = new Date(new Date(iso).getTime() + config.tzOffset * 3600 * 1000);
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${formatDateKey(key)}, ${hh}:${mm}`;
}

export function isoWeekNumber(dateKey = localDate()) {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const ftDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ftDay + 3);
  return 1 + Math.round((d - firstThursday) / (7 * DAY_MS));
}

export function weekLabel(dateKey = localDate()) {
  return `${new Date(dateKey).getUTCFullYear()}-W${String(isoWeekNumber(dateKey)).padStart(2, '0')}`;
}

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema.js';
import { addDays, localDate, nowIso } from '../utils/date.js';

let db = null;

export function openDb(filePath = config.dbPath) {
  if (db) return db;
  const isMemory = filePath === ':memory:';
  if (!isMemory) fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  db = new DatabaseSync(filePath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA_SQL);
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run('schema_version', String(SCHEMA_VERSION));
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

export function getDb() {
  return db ?? openDb();
}

/** Только для тестов: подменить/сбросить соединение. */
export function resetDbForTests(filePath = ':memory:') {
  closeDb();
  return openDb(filePath);
}

/* ---------------------------------------------------------------- users */

export function ensureUser(from) {
  const id = Number(from.id);
  const existing = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (existing) {
    getDb().prepare('UPDATE users SET username = ?, first_name = ? WHERE id = ?')
      .run(from.username ?? null, from.first_name ?? null, id);
    return { ...existing, username: from.username ?? null, first_name: from.first_name ?? null, isNew: false };
  }
  getDb().prepare(`INSERT INTO users (id, username, first_name, created_at) VALUES (?, ?, ?, ?)`)
    .run(id, from.username ?? null, from.first_name ?? null, nowIso());
  return { ...getDb().prepare('SELECT * FROM users WHERE id = ?').get(id), isNew: true };
}

export function getUser(userId) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(Number(userId));
}

export function setEnglishOnly(userId, value) {
  getDb().prepare('UPDATE users SET english_only = ? WHERE id = ?').run(value ? 1 : 0, Number(userId));
}

export function setLevelHint(userId, level) {
  getDb().prepare('UPDATE users SET level_hint = ? WHERE id = ?').run(level, Number(userId));
}

export function addUserXp(userId, amount) {
  getDb().prepare('UPDATE users SET xp = xp + ? WHERE id = ?').run(amount, Number(userId));
}

/* --------------------------------------------------------------- states */

export function getState(userId) {
  const row = getDb().prepare('SELECT * FROM states WHERE user_id = ?').get(Number(userId));
  if (!row) return { mode: '', payload: {} };
  let payload = {};
  try {
    payload = JSON.parse(row.payload || '{}');
  } catch {
    payload = {};
  }
  return { mode: row.mode, payload };
}

export function setState(userId, mode, payload = {}) {
  getDb().prepare(`INSERT INTO states (user_id, mode, payload, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET mode = excluded.mode, payload = excluded.payload, updated_at = excluded.updated_at`)
    .run(Number(userId), mode, JSON.stringify(payload), nowIso());
}

export function clearState(userId) {
  setState(userId, '', {});
}

/* ------------------------------------------------------------- activity */

export function getActivity(userId, fromDate, toDate = localDate()) {
  return getDb().prepare('SELECT * FROM activity WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date')
    .all(Number(userId), fromDate, toDate);
}

export function getActivityMap(userId, fromDate, toDate = localDate()) {
  const map = new Map();
  for (const row of getActivity(userId, fromDate, toDate)) map.set(row.date, row);
  return map;
}

export function touchActivity(userId, { actions = 1, xp = 0 } = {}) {
  const date = localDate();
  getDb().prepare(`INSERT INTO activity (user_id, date, actions, xp) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET actions = activity.actions + excluded.actions, xp = activity.xp + excluded.xp`)
    .run(Number(userId), date, actions, xp);
}

/** Активность за конкретный день (для дневного бонуса XP). */
export function getDayActivity(userId, dateKey = localDate()) {
  return getDb().prepare('SELECT * FROM activity WHERE user_id = ? AND date = ?').get(Number(userId), dateKey);
}

/** Стрик: +1 если вчера, сброс если был разрыв. Возвращает актуальный стрик. */
export function bumpStreak(userId) {
  const user = getUser(userId);
  if (!user) return 0;
  const today = localDate();
  const yesterday = addDays(today, -1);
  if (user.last_active_date === today) return user.streak_current;
  const next = user.last_active_date === yesterday ? user.streak_current + 1 : 1;
  const best = Math.max(next, user.streak_best ?? 0);
  getDb().prepare('UPDATE users SET streak_current = ?, streak_best = ?, last_active_date = ? WHERE id = ?')
    .run(next, best, today, Number(userId));
  return next;
}

export function practiceDaysCount(userId) {
  return getDb().prepare('SELECT COUNT(*) AS c FROM activity WHERE user_id = ? AND actions > 0')
    .get(Number(userId)).c;
}

/* ---------------------------------------------------------------- diary */

export function addDiaryEntry(userId, text, { wordCount = 0, mistakes = 0 } = {}) {
  const created = nowIso();
  const info = getDb().prepare(`INSERT INTO diary (user_id, text, word_count, mistakes, created_at, date)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run(Number(userId), text, wordCount, mistakes, created, localDate());
  return Number(info.lastInsertRowid);
}

export function countDiary(userId) {
  return getDb().prepare('SELECT COUNT(*) AS c FROM diary WHERE user_id = ?').get(Number(userId)).c;
}

export function recentDiary(userId, limit = 5) {
  return getDb().prepare('SELECT * FROM diary WHERE user_id = ? ORDER BY id DESC LIMIT ?')
    .all(Number(userId), limit);
}

/* -------------------------------------------------------------- writing */

export function addWriting(userId, { topic, text, wordCount, score, feedback }) {
  const info = getDb().prepare(`INSERT INTO writing (user_id, topic, text, word_count, score, feedback, created_at, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(Number(userId), topic, text, wordCount, score, feedback, nowIso(), localDate());
  return Number(info.lastInsertRowid);
}

export function countWriting(userId) {
  return getDb().prepare('SELECT COUNT(*) AS c FROM writing WHERE user_id = ?').get(Number(userId)).c;
}

export function recentWritingScores(userId, limit = 5) {
  return getDb().prepare('SELECT score, word_count, date FROM writing WHERE user_id = ? ORDER BY id DESC LIMIT ?')
    .all(Number(userId), limit);
}

export function listWriting(userId, limit = 5) {
  return getDb().prepare('SELECT * FROM writing WHERE user_id = ? ORDER BY id DESC LIMIT ?')
    .all(Number(userId), limit);
}

/* ---------------------------------------------------------------- words */

export function addWord(userId, { word, translation = '', example = '' }) {
  const clean = word.trim();
  const existing = getDb().prepare('SELECT * FROM words WHERE user_id = ? AND lower(word) = lower(?)')
    .get(Number(userId), clean);
  if (existing) return { ...existing, duplicate: true };
  const info = getDb().prepare(`INSERT INTO words (user_id, word, translation, example, due_date, created_at, date)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(Number(userId), clean, translation.trim(), example.trim(), localDate(), nowIso(), localDate());
  return { ...getDb().prepare('SELECT * FROM words WHERE id = ?').get(Number(info.lastInsertRowid)), duplicate: false };
}

export function countWords(userId) {
  return getDb().prepare('SELECT COUNT(*) AS c FROM words WHERE user_id = ?').get(Number(userId)).c;
}

export function wordsAddedSince(userId, dateKey) {
  return getDb().prepare('SELECT COUNT(*) AS c FROM words WHERE user_id = ? AND date >= ?')
    .get(Number(userId), dateKey).c;
}

export function listWords(userId, limit = 20) {
  return getDb().prepare('SELECT * FROM words WHERE user_id = ? ORDER BY id DESC LIMIT ?')
    .all(Number(userId), limit);
}

export function dueWords(userId, limit = 10) {
  return getDb().prepare('SELECT * FROM words WHERE user_id = ? AND due_date <= ? ORDER BY due_date, id LIMIT ?')
    .all(Number(userId), localDate(), limit);
}

export function countDueWords(userId) {
  return getDb().prepare('SELECT COUNT(*) AS c FROM words WHERE user_id = ? AND due_date <= ?')
    .get(Number(userId), localDate()).c;
}

const BOX_INTERVALS = [0, 1, 2, 4, 7, 14, 30];

export function reviewWord(userId, wordId, known) {
  const row = getDb().prepare('SELECT * FROM words WHERE id = ? AND user_id = ?').get(Number(wordId), Number(userId));
  if (!row) return null;
  const box = known ? Math.min((row.box ?? 0) + 1, BOX_INTERVALS.length - 1) : 0;
  const interval = BOX_INTERVALS[box] || 1;
  const due = addDays(localDate(), known ? interval : 1);
  getDb().prepare('UPDATE words SET box = ?, due_date = ?, correct = correct + ?, wrong = wrong + ? WHERE id = ?')
    .run(box, due, known ? 1 : 0, known ? 0 : 1, row.id);
  return { ...row, box, due_date: due };
}

/* -------------------------------------------------------------- grammar */

export function addGrammarAttempt(userId, { topic, prompt, given = '', answer = '', isCorrect }) {
  getDb().prepare(`INSERT INTO grammar_attempts (user_id, topic, prompt, given, answer, is_correct, created_at, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(Number(userId), topic, prompt, given, answer, isCorrect ? 1 : 0, nowIso(), localDate());
}

export function grammarStats(userId, fromDate = '0000-01-01', toDate = '9999-12-31') {
  const row = getDb().prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(is_correct), 0) AS correct
    FROM grammar_attempts WHERE user_id = ? AND date >= ? AND date <= ?`)
    .get(Number(userId), fromDate, toDate);
  return { total: row.total, correct: row.correct, accuracy: row.total ? Math.round((row.correct / row.total) * 100) : 0 };
}

/** Точность по темам упражнений. */
export function grammarByTopic(userId) {
  return getDb().prepare(`SELECT topic, COUNT(*) AS total, COALESCE(SUM(is_correct), 0) AS correct
    FROM grammar_attempts WHERE user_id = ? GROUP BY topic ORDER BY total DESC`)
    .all(Number(userId))
    .map((row) => ({
      ...row,
      accuracy: row.total ? Math.round((row.correct / row.total) * 100) : 0,
    }));
}

export function grammarStreakNow(userId) {
  const rows = getDb().prepare('SELECT is_correct FROM grammar_attempts WHERE user_id = ? ORDER BY id DESC LIMIT 50')
    .all(Number(userId));
  let streak = 0;
  for (const row of rows) {
    if (!row.is_correct) break;
    streak += 1;
  }
  return streak;
}

/* ------------------------------------------------------------- mistakes */

export function recordMistake(userId, { tag, title, wrong = '', right = '', hints = [] }) {
  if (!tag) return;
  getDb().prepare(`INSERT INTO mistakes (user_id, tag, title, wrong, right, hints, count, last_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(user_id, tag) DO UPDATE SET
      title = excluded.title,
      wrong = CASE WHEN excluded.wrong <> '' THEN excluded.wrong ELSE mistakes.wrong END,
      right = CASE WHEN excluded.right <> '' THEN excluded.right ELSE mistakes.right END,
      hints = CASE WHEN excluded.hints <> '[]' THEN excluded.hints ELSE mistakes.hints END,
      count = mistakes.count + 1,
      last_at = excluded.last_at`)
    .run(Number(userId), tag, title, wrong, right, JSON.stringify(hints), nowIso());
  getDb().prepare('INSERT INTO mistake_events (user_id, tag, date, created_at) VALUES (?, ?, ?, ?)')
    .run(Number(userId), tag, localDate(), nowIso());
}

/** Топ ошибок за период: считаем по событиям, детали берём из агрегата. */
export function topMistakes(userId, { fromDate = '0000-01-01', toDate = localDate(), limit = 5 } = {}) {
  const rows = getDb().prepare(`SELECT tag, COUNT(*) AS count FROM mistake_events
    WHERE user_id = ? AND date >= ? AND date <= ?
    GROUP BY tag ORDER BY count DESC LIMIT ?`)
    .all(Number(userId), fromDate, toDate, limit);
  const detail = getDb().prepare('SELECT * FROM mistakes WHERE user_id = ? AND tag = ?');
  return rows.map((row) => {
    const info = detail.get(Number(userId), row.tag) ?? {};
    let hints = [];
    try {
      hints = JSON.parse(info.hints || '[]');
    } catch {
      hints = [];
    }
    return {
      tag: row.tag,
      title: info.title ?? row.tag,
      wrong: info.wrong ?? '',
      right: info.right ?? '',
      hints,
      count: row.count,
      last_at: info.last_at ?? null,
    };
  });
}

/** Сколько ошибок зафиксировано в диапазоне дат. */
export function mistakesCountRange(userId, fromDate, toDate = localDate()) {
  return getDb().prepare('SELECT COUNT(*) AS c FROM mistake_events WHERE user_id = ? AND date >= ? AND date <= ?')
    .get(Number(userId), fromDate, toDate).c;
}

export function mistakesCountSince(userId, fromDate) {
  return getDb().prepare('SELECT COUNT(*) AS c FROM mistake_events WHERE user_id = ? AND date >= ?')
    .get(Number(userId), fromDate).c;
}

/* ---------------------------------------------------------------- goals */

export function addGoal(userId, { metric, title, target }) {
  const info = getDb().prepare('INSERT INTO goals (user_id, metric, title, target, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(Number(userId), metric, title, Number(target), nowIso());
  return Number(info.lastInsertRowid);
}

export function listGoals(userId, includeArchived = false) {
  const sql = includeArchived
    ? 'SELECT * FROM goals WHERE user_id = ? ORDER BY archived, id'
    : 'SELECT * FROM goals WHERE user_id = ? AND archived = 0 ORDER BY id';
  return getDb().prepare(sql).all(Number(userId));
}

export function archiveGoal(userId, goalId) {
  getDb().prepare('UPDATE goals SET archived = 1 WHERE id = ? AND user_id = ?').run(Number(goalId), Number(userId));
}

/* --------------------------------------------------------- achievements */

export function unlockedAchievements(userId) {
  return getDb().prepare('SELECT * FROM achievements WHERE user_id = ? ORDER BY unlocked_at').all(Number(userId));
}

export function unlockAchievement(userId, code) {
  const info = getDb().prepare('INSERT OR IGNORE INTO achievements (user_id, code, unlocked_at) VALUES (?, ?, ?)')
    .run(Number(userId), code, nowIso());
  return info.changes > 0;
}

/* ----------------------------------------------------------- chat (AI) */

export function addChatMessage(userId, role, text) {
  getDb().prepare('INSERT INTO chat_messages (user_id, role, text, created_at) VALUES (?, ?, ?, ?)')
    .run(Number(userId), role, text, nowIso());
  getDb().prepare(`DELETE FROM chat_messages WHERE user_id = ? AND id NOT IN
    (SELECT id FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT 30)`)
    .run(Number(userId), Number(userId));
}

export function chatHistory(userId, limit = 12) {
  return getDb().prepare('SELECT role, text FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT ?')
    .all(Number(userId), limit)
    .reverse();
}

export function countChatMessages(userId) {
  return getDb().prepare("SELECT COUNT(*) AS c FROM chat_messages WHERE user_id = ? AND role = 'user'")
    .get(Number(userId)).c;
}

export function clearChatHistory(userId) {
  getDb().prepare('DELETE FROM chat_messages WHERE user_id = ?').run(Number(userId));
}

/* ---------------------------------------------------------------- stats */

export function rangeCounts(userId, fromDate, toDate) {
  const count = (table) => getDb()
    .prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE user_id = ? AND date >= ? AND date <= ?`)
    .get(Number(userId), fromDate, toDate).c;
  return {
    words: count('words'),
    diary: count('diary'),
    writing: count('writing'),
    grammar: grammarStats(userId, fromDate, toDate),
    practiceDays: getActivity(userId, fromDate, toDate).filter((row) => row.actions > 0).length,
  };
}

export function userStats(userId) {
  return {
    diary: countDiary(userId),
    words: countWords(userId),
    grammar: grammarStats(userId),
    writing: countWriting(userId),
    practiceDays: practiceDaysCount(userId),
    dueWords: countDueWords(userId),
    chatMessages: countChatMessages(userId),
  };
}


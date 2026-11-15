import * as db from '../db/index.js';
import { checkAchievements } from './achievements.js';
import { localDate } from '../utils/date.js';

/**
 * Игровые уровни (не CEFR).
 * Beginner -> Explorer -> Intermediate -> Advanced -> Fluent
 */
export const LEVELS = [
  { code: 'beginner', name: 'Beginner', emoji: '🌱', min: 0 },
  { code: 'explorer', name: 'Explorer', emoji: '🧭', min: 300 },
  { code: 'intermediate', name: 'Intermediate', emoji: '🚀', min: 900 },
  { code: 'advanced', name: 'Advanced', emoji: '🏅', min: 2000 },
  { code: 'fluent', name: 'Fluent', emoji: '👑', min: 4000 },
];

export const XP_AWARDS = {
  diary: 25,
  word: 10,
  wordReview: 6,
  grammarCorrect: 12,
  // Ошибка в ответе — упражнение не приносит XP, только практику.
  grammarWrong: 0,
  // Ошибки в тексте (дневник, writing, чат): работа сохраняется и запоминается, XP = 0.
  mistakes: 0,
  writing: 40,
  chat: 5,
  goalDone: 30,
  dailyBonus: 15,
};

export const ACHIEVEMENT_XP = 50;

export function levelFor(xp) {
  const safe = Math.max(0, Number(xp) || 0);
  let index = 0;
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (safe >= LEVELS[i].min) index = i;
  }
  const current = LEVELS[index];
  const next = LEVELS[index + 1] ?? null;
  const span = next ? next.min - current.min : 1;
  const progress = next ? safe - current.min : span;
  return {
    index,
    code: current.code,
    name: current.name,
    emoji: current.emoji,
    min: current.min,
    xp: safe,
    next: next ? next.min : null,
    nextName: next ? next.name : null,
    toNext: next ? Math.max(0, next.min - safe) : 0,
    percent: next ? Math.min(100, Math.round((progress / span) * 100)) : 100,
  };
}

/**
 * Единая точка начисления: XP + активность + стрик + достижения + level up.
 * @returns {{xp:number, base:number, bonus:number, streak:number, unlocked:Array, levelUp:null|object, level:object}}
 */
export function award(userId, kind, options = {}) {
  const base = options.xp ?? XP_AWARDS[kind] ?? 0;
  const today = db.getDayActivity(userId, localDate());
  const firstToday = !today || today.actions === 0;
  // Нет базового XP (например, текст с ошибками) — дневной бонус тоже не начисляем.
  const bonus = firstToday && base > 0 ? XP_AWARDS.dailyBonus : 0;

  const before = db.getUser(userId);
  const levelBefore = levelFor(before?.xp ?? 0);

  const streak = db.bumpStreak(userId);
  const total = base + bonus;
  if (total > 0) db.addUserXp(userId, total);
  db.touchActivity(userId, { actions: options.actions ?? 1, xp: total });

  // Достижения могут открыться от нового действия/стрика.
  const { unlocked } = checkAchievements(userId);
  const achievementXp = unlocked.length * ACHIEVEMENT_XP;
  for (let i = 0; i < unlocked.length; i += 1) {
    db.addUserXp(userId, ACHIEVEMENT_XP);
    db.touchActivity(userId, { actions: 0, xp: ACHIEVEMENT_XP });
  }

  const after = db.getUser(userId);
  const level = levelFor(after?.xp ?? 0);
  return {
    xp: total + achievementXp,
    base,
    bonus,
    firstToday,
    streak,
    unlocked,
    level,
    totalXp: after?.xp ?? 0,
    levelUp: level.index > levelBefore.index ? { from: levelBefore, to: level } : null,
  };
}

export function userLevel(userId) {
  const user = db.getUser(userId);
  return levelFor(user?.xp ?? 0);
}

/** Текст-строка прогресса уровня: 🌱 Beginner · 120 / 300 XP. */
export function levelLine(xp) {
  const level = levelFor(xp);
  if (!level.next) return `${level.emoji} ${level.name} · ${level.xp} XP (максимум)`;
  return `${level.emoji} ${level.name} · ${level.xp} / ${level.next} XP`;
}

export function xpBar(xp, width = 10) {
  const level = levelFor(xp);
  const filled = Math.round((level.percent / 100) * width);
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))} ${level.percent}%`;
}

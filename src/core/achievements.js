import * as db from '../db/index.js';

/**
 * Достижения: таблица из ТЗ.
 * metric - поле контекста, target - порог.
 */
export const ACHIEVEMENTS = [
  { code: 'first_entry', emoji: '📖', title: 'First Entry', desc: 'Первая запись в дневнике', metric: 'diary', target: 1 },
  { code: 'word_collector', emoji: '📚', title: 'Word Collector', desc: '50 сохранённых слов', metric: 'words', target: 50 },
  { code: 'streak_7', emoji: '🔥', title: '7-Day Streak', desc: '7 дней практики подряд', metric: 'streakBest', target: 7 },
  { code: 'grammar_master', emoji: '🎯', title: 'Grammar Master', desc: 'Серия из 10 верных ответов', metric: 'grammarStreak', target: 10 },
  { code: 'writing_lover', emoji: '✍️', title: 'Writing Lover', desc: '20 текстов', metric: 'writing', target: 20 },
  { code: 'consistency', emoji: '🏆', title: 'Consistency', desc: '30 дней активности', metric: 'practiceDays', target: 30 },
];

export const ACHIEVEMENT_BY_CODE = new Map(ACHIEVEMENTS.map((a) => [a.code, a]));

export function achievementContext(userId) {
  const stats = db.userStats(userId);
  const user = db.getUser(userId);
  return {
    diary: stats.diary,
    words: stats.words,
    writing: stats.writing,
    practiceDays: stats.practiceDays,
    streakBest: user?.streak_best ?? 0,
    grammarStreak: db.grammarStreakNow(userId),
  };
}

export function progressOf(achievement, ctx) {
  const value = ctx[achievement.metric] ?? 0;
  const percent = Math.min(100, Math.round((value / achievement.target) * 100));
  return { value, target: achievement.target, percent, done: value >= achievement.target };
}

/** Проверяет все достижения, выдаёт новые. Возвращает список новых. */
export function checkAchievements(userId) {
  const ctx = achievementContext(userId);
  const unlocked = [];
  for (const achievement of ACHIEVEMENTS) {
    if (ctx[achievement.metric] >= achievement.target && db.unlockAchievement(userId, achievement.code)) {
      unlocked.push(achievement);
    }
  }
  return { unlocked, ctx };
}

/** Полный список для экрана достижений. */
export function achievementList(userId) {
  const ctx = achievementContext(userId);
  const unlockedMap = new Map(db.unlockedAchievements(userId).map((row) => [row.code, row.unlocked_at]));
  return ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    ...progressOf(achievement, ctx),
    unlocked: unlockedMap.has(achievement.code),
    unlockedAt: unlockedMap.get(achievement.code) ?? null,
  }));
}

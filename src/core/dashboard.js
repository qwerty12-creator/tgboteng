import * as db from '../db/index.js';
import { escapeHtml, arrow } from './insights.js';
import { levelFor, xpBar } from './xp.js';
import { formatDateKey, lastNDates, localDate } from '../utils/date.js';

const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

export function activityBlocks(values) {
  const max = Math.max(1, ...values);
  return values
    .map((value) => {
      if (!value) return '·';
      const index = Math.min(BLOCKS.length - 1, Math.ceil((value / max) * BLOCKS.length) - 1);
      return BLOCKS[index];
    })
    .join('');
}

export const GOAL_METRICS = [
  { metric: 'diary', title: 'Diary entries', label: 'Записей в дневнике' },
  { metric: 'words', title: 'Words collected', label: 'Сохранённых слов' },
  { metric: 'grammar', title: 'Grammar exercises', label: 'Грамматических упражнений' },
  { metric: 'practiceDays', title: 'Practice days', label: 'Дней практики' },
  { metric: 'writing', title: 'Writing submissions', label: 'Текстов написано' },
];

export const METRIC_TITLE = new Map(GOAL_METRICS.map((item) => [item.metric, item]));

/** Значение метрики для целей. */
export function goalValue(userId, metric, stats = db.userStats(userId)) {
  switch (metric) {
    case 'diary':
      return stats.diary;
    case 'words':
      return stats.words;
    case 'grammar':
      return stats.grammar.total;
    case 'practiceDays':
      return stats.practiceDays;
    case 'writing':
      return stats.writing;
    default:
      return 0;
  }
}

export function goalsWithProgress(userId, stats = db.userStats(userId)) {
  return db.listGoals(userId).map((goal) => {
    const current = Math.min(goalValue(userId, goal.metric, stats), goal.target);
    const percent = goal.target ? Math.min(100, Math.round((current / goal.target) * 100)) : 0;
    return { ...goal, current, percent, done: current >= goal.target };
  });
}

export function progressBar(percent, width = 10) {
  const filled = Math.round((Math.min(100, percent) / 100) * width);
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}`;
}

export function goalsText(userId, stats = db.userStats(userId)) {
  const goals = goalsWithProgress(userId, stats);
  if (!goals.length) return '🎯 Цели пока не заданы. Добавь первую цель.';
  return goals
    .map((goal) => {
      const title = METRIC_TITLE.get(goal.metric)?.label ?? goal.title;
      const mark = goal.done ? '✅' : '🎯';
      return `${mark} <b>${escapeHtml(title)}</b>\n${progressBar(goal.percent)} ${goal.current}/${goal.target}`;
    })
    .join('\n\n');
}

export function wordsSummaryText(userId) {
  const stats = db.userStats(userId);
  return `<b>📚 Слова</b>\nВсего: ${stats.words}\nК повторению сегодня: ${stats.dueWords}`;
}

/** Полный экран YOUR ENGLISH JOURNEY. */
export function buildDashboard(userId, user) {
  const stats = db.userStats(userId);
  const level = levelFor(user?.xp ?? 0);
  const dates = lastNDates(30);
  const activityMap = db.getActivityMap(userId, dates[0]);
  const values = dates.map((date) => activityMap.get(date)?.actions ?? 0);
  const monthActions = values.reduce((sum, value) => sum + value, 0);
  const peakValue = Math.max(...values);
  const peakIndex = values.indexOf(peakValue);
  const weekFrom = dates[dates.length - 7];
  const prevFrom = dates[dates.length - 14];
  const prevTo = dates[dates.length - 8];
  const wordsWeek = db.wordsAddedSince(userId, weekFrom);
  const wordsMonth = db.wordsAddedSince(userId, `${localDate().slice(0, 8)}01`);
  const mistakes = db.topMistakes(userId, { limit: 3 });
  const dyn = db.rangeCounts(userId, weekFrom, localDate());
  const prev = db.rangeCounts(userId, prevFrom, prevTo);

  const table = [
    'Metric                Result',
    '────────────────────────────',
    `Diary entries   ${String(stats.diary).padStart(10)}`,
    `Words collected ${String(stats.words).padStart(10)}`,
    `Grammar exerc.  ${String(stats.grammar.total).padStart(10)}`,
    `Practice days   ${String(stats.practiceDays).padStart(10)}`,
    `Writing subm.   ${String(stats.writing).padStart(10)}`,
    '────────────────────────────',
    `Accuracy        ${String(`${stats.grammar.accuracy}%`).padStart(10)}`,
  ].join('\n');

  const parts = [];
  parts.push('<b>📊 YOUR ENGLISH JOURNEY</b>');
  parts.push(`${level.emoji} <b>${level.name}</b> · ${level.xp} XP${level.next ? ` / ${level.next}` : ''}\n${xpBar(user?.xp ?? 0, 12)}`);
  parts.push(`🔥 Стрик: ${user?.streak_current ?? 0} дн. · рекорд ${user?.streak_best ?? 0} дн.`);
  parts.push(`<pre>${escapeHtml(table)}</pre>`);

  parts.push(
    [
      '<b>График активности за месяц</b>',
      `${formatDateKey(dates[0])} → ${formatDateKey(dates[dates.length - 1])}`,
      `<code>${activityBlocks(values)}</code>`,
      `Действий: ${monthActions}${peakValue ? ` · пик ${peakValue} (${formatDateKey(dates[peakIndex])})` : ''}`,
    ].join('\n'),
  );

  parts.push(
    [
      '<b>Новые слова</b>',
      `• за 7 дней: ${wordsWeek}`,
      `• за месяц: ${wordsMonth}`,
      `• к повторению: ${stats.dueWords}`,
    ].join('\n'),
  );

  if (mistakes.length) {
    const lines = ['<b>Частые грамматические ошибки</b>'];
    mistakes.forEach((item, index) => {
      lines.push(`${index + 1}. ${escapeHtml(item.title)} — ${item.count}×`);
      if (item.wrong && item.right) lines.push(`   <i>${escapeHtml(item.wrong)} → ${escapeHtml(item.right)}</i>`);
    });
    parts.push(lines.join('\n'));
  } else {
    parts.push('<b>Частые грамматические ошибки</b>\nПока не собраны — напиши запись или текст, и я начну анализировать.');
  }

  const accuracyDelta = dyn.grammar.total && prev.grammar.total ? dyn.grammar.accuracy - prev.grammar.accuracy : 0;
  const deltaTable = [
    `Words     ${arrow(dyn.words - prev.words)}`,
    `Diary     ${arrow(dyn.diary - prev.diary)}`,
    `Grammar   ${arrow(dyn.grammar.total - prev.grammar.total)}`,
    `Writing   ${arrow(dyn.writing - prev.writing)}`,
    `Days      ${arrow(dyn.practiceDays - prev.practiceDays)}`,
    `Accuracy  ${arrow(accuracyDelta, '%')}`,
  ].join('\n');
  parts.push(`<b>Динамика (эта неделя / прошлая)</b>\n<code>${deltaTable}</code>`);

  parts.push(`<b>Текущие цели</b>\n${goalsText(userId, stats)}`);

  let text = parts.join('\n\n');
  if (text.length > 3800) text = `${text.slice(0, 3800)}…`;
  return { text, stats, level, mistakes };
}


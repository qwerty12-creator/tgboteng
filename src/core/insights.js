import * as db from '../db/index.js';
import { addDays, formatDateKey, localDate } from '../utils/date.js';

/** Какое упражнение тренирует ошибку. */
export const TAG_TO_TOPIC = {
  past_after_aux: 'past_simple',
  present_perfect_pp: 'present_perfect',
  past_marker_be: 'past_simple',
  past_marker_verb: 'past_simple',
  subject_verb_agreement: 'agreement',
  subject_have: 'agreement',
  plural_do: 'agreement',
  third_person_s: 'agreement',
  missing_be: 'agreement',
  be_agree: 'agreement',
  missing_article: 'articles',
  a_an: 'articles',
  uncountable_nouns: 'quantifiers',
  double_comparative: 'comparatives',
  quantifiers: 'quantifiers',
  many_uncountable: 'quantifiers',
  depend_of: 'prepositions',
  listen_music: 'prepositions',
  married_with: 'prepositions',
  explain_me: 'prepositions',
  weekday_preposition: 'prepositions',
  picture_preposition: 'prepositions',
  since_for: 'prepositions',
  do_make_mistake: 'past_simple',
  make_photo: 'past_simple',
  make_homework: 'past_simple',
  everyday_adverb: 'quantifiers',
  age_expression: 'agreement',
  double_negative: 'agreement',
  ed_ing_adjectives: 'agreement',
  pronoun_capitalization: 'agreement',
  sentence_capitalization: 'agreement',
};

const DEFAULT_VERBS = ['went', 'saw', 'bought', 'thought', 'brought'];

/** Периоды "эта неделя" и "прошлая неделя". */
export function weekRanges(today = localDate()) {
  return {
    today,
    currentFrom: addDays(today, -6),
    previousFrom: addDays(today, -13),
    previousTo: addDays(today, -7),
  };
}

/** Сравнение результатов за 7 дней с предыдущими 7 днями. */
export function dynamics(userId, today = localDate()) {
  const { currentFrom, previousFrom, previousTo } = weekRanges(today);
  const current = db.rangeCounts(userId, currentFrom, today);
  const previous = db.rangeCounts(userId, previousFrom, previousTo);
  return {
    current,
    previous,
    delta: {
      words: current.words - previous.words,
      diary: current.diary - previous.diary,
      grammar: current.grammar.total - previous.grammar.total,
      writing: current.writing - previous.writing,
      accuracy: current.grammar.total && previous.grammar.total
        ? current.grammar.accuracy - previous.grammar.accuracy
        : 0,
      practiceDays: current.practiceDays - previous.practiceDays,
    },
  };
}

export function arrow(value, unit = '') {
  if (value > 0) return `▲ +${value}${unit}`;
  if (value < 0) return `▼ ${value}${unit}`;
  return `▬ 0${unit}`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Топ ошибок за период + подсказки для практики. */
export function mistakeProfile(userId, days = 7, limit = 4) {
  const from = addDays(localDate(), -(days - 1));
  const items = db.topMistakes(userId, { fromDate: from, limit });
  return items.map((item) => {
    // Ошибки упражнений пишутся с тегом grammar:<topic>, остальные маппим по таблице.
    const topic = String(item.tag).startsWith('grammar:')
      ? String(item.tag).slice('grammar:'.length)
      : (TAG_TO_TOPIC[item.tag] ?? null);
    return {
      ...item,
      topic,
      practice: item.hints && item.hints.length
        ? item.hints
        : (topic === 'past_simple' ? DEFAULT_VERBS : []),
    };
  });
}

export function totalMistakes(userId, days = 7) {
  return db.mistakesCountSince(userId, addDays(localDate(), -(days - 1)));
}

/** Рекомендованная тема: где больше всего ошибок. */
export function recommendedTopic(userId) {
  const mistakes = mistakeProfile(userId, 30, 8);
  const score = new Map();
  for (const item of mistakes) {
    if (!item.topic) continue;
    score.set(item.topic, (score.get(item.topic) ?? 0) + item.count);
  }
  let best = null;
  for (const [topic, value] of score) {
    if (!best || value > best.value) best = { topic, value };
  }
  return best;
}

/**
 * Weekly insight: что повторяется, что тренировать, стало ли лучше.
 */
export function weeklyInsight(userId, today = localDate()) {
  const from = addDays(today, -6);
  const prevFrom = addDays(today, -13);
  const top = mistakeProfile(userId, 7, 3);
  const currentCount = db.mistakesCountSince(userId, from);
  const previousCount = Math.max(0, db.mistakesCountSince(userId, prevFrom) - currentCount);
  const stats = db.rangeCounts(userId, from, today);

  if (!top.length) {
    return {
      text: [
        '<b>Your weekly insight</b>',
        '',
        'Пока нет накопленных ошибок для анализа. Напиши запись в дневнике, текст или поговори с ботом — и я начну замечать закономерности.',
        '',
        stats.practiceDays
          ? `На этой неделе практики: ${stats.practiceDays} дн. Так держать!`
          : 'Начни с одной записи в дневнике — это 2 минуты.',
      ].join('\n'),
      hasData: false,
      topMistake: null,
      currentCount,
      previousCount,
    };
  }

  const main = top[0];
  const lines = ['<b>Your weekly insight</b>', ''];

  if (main.topic === 'past_simple') {
    lines.push('You frequently make mistakes with irregular verbs.', '');
    lines.push("Let's practice:");
    for (const verb of main.practice.slice(0, 5)) lines.push(`• ${verb}`);
  } else {
    lines.push(`Чаще всего повторяется: <b>${escapeHtml(main.title)}</b> (${main.count}× за неделю).`);
    if (main.wrong && main.right) {
      lines.push(`Пример: ${escapeHtml(main.wrong)} → <b>${escapeHtml(main.right)}</b>`);
    }
    lines.push('');
    lines.push('Что тренируем:');
    for (const item of top.slice(0, 3)) lines.push(`• ${escapeHtml(item.title)}`);
  }

  lines.push('');
  if (currentCount < previousCount) {
    lines.push(`📉 Ошибок меньше, чем на прошлой неделе: ${previousCount} → ${currentCount}. Прогресс виден!`);
  } else if (currentCount > previousCount) {
    lines.push(`📈 Ошибок больше, чем на прошлой неделе: ${previousCount} → ${currentCount}. Это нормально: ты больше пишешь.`);
  } else {
    lines.push(`➖ Столько же ошибок, как на прошлой неделе (${currentCount}). Стоит закрепить тему упражнениями.`);
  }
  lines.push(`Период: ${formatDateKey(from)} – ${formatDateKey(today)}`);

  return {
    text: lines.join('\n'),
    hasData: true,
    topMistake: main,
    currentCount,
    previousCount,
    improved: currentCount < previousCount,
  };
}


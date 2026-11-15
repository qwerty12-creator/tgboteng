import { GRAMMAR_BANK, TOPICS, TOPIC_BY_ID, bankForTopic } from '../content/grammarBank.js';
import { IRREGULAR_VERBS, sample } from '../content/verbs.js';

export { TOPICS, TOPIC_BY_ID };

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Добавляет правильные варианты ответа из ручного банка и перемешивает их. */
export function buildExercise(item) {
  const options = shuffle(item.options);
  const answer = options.indexOf(item.options[item.answer]);
  return {
    topic: item.topic,
    topicTitle: TOPIC_BY_ID.get(item.topic)?.title ?? 'Grammar',
    prompt: item.prompt,
    options,
    answer,
    explain: item.explain,
  };
}

const ACTIVE_VERBS = IRREGULAR_VERBS.filter((verb) => verb.past !== verb.base);

/** Динамическое упражнение на неправильные глаголы (Past Simple / Participle). */
export function generatedIrregularExercise({ form } = {}) {
  const verb = sample(ACTIVE_VERBS, 1)[0];
  const mode = form ?? (Math.random() < 0.65 ? 'past' : 'pp');
  const others = sample(ACTIVE_VERBS.filter((v) => v.base !== verb.base), 3);
  let correct;
  let prompt;
  let distractors;
  let explain;

  if (mode === 'past') {
    correct = verb.past;
    prompt = `Choose the correct Past Simple form:\n\n${verb.base} → ___  (${verb.ru})`;
    distractors = [verb.base, verb.pp, ...others.map((v) => v.past)];
    explain = `${verb.base} – ${verb.past} – ${verb.pp}: Past Simple = ${verb.past}.`;
  } else {
    correct = verb.pp;
    prompt = `Choose the correct Past Participle (after have / has):\n\n${verb.base} → have ___  (${verb.ru})`;
    distractors = [verb.base, verb.past, ...others.map((v) => v.pp)];
    explain = `${verb.base} – ${verb.past} – ${verb.pp}: после have/has — ${verb.pp}.`;
  }

  const unique = [];
  for (const option of [correct, ...distractors]) {
    if (!unique.includes(option)) unique.push(option);
  }
  const options = shuffle(unique.slice(0, 4));
  return {
    topic: 'past_simple',
    topicTitle: TOPIC_BY_ID.get('past_simple').title,
    prompt,
    options,
    answer: options.indexOf(correct),
    explain,
  };
}

function poolFor(topicId) {
  if (!topicId) return GRAMMAR_BANK;
  const pool = bankForTopic(topicId);
  return pool.length ? pool : GRAMMAR_BANK;
}

/**
 * Готовит список вопросов для сессии.
 * Для Past Simple часть вопросов генерируется автоматически.
 */
export function pickQuestions(topicId, count = 10) {
  const pool = poolFor(topicId);
  const allowGenerated = !topicId || topicId === 'past_simple';
  const target = Math.min(count, allowGenerated ? 10 : Math.max(3, pool.length));
  const usedBank = new Set();
  const usedPrompts = new Set();
  const questions = [];

  let guard = 0;
  while (questions.length < target && guard < 300) {
    guard += 1;
    const useGenerated = allowGenerated && Math.random() < 0.4;
    let question;
    if (useGenerated) {
      question = shuffle([generatedIrregularExercise(), generatedIrregularExercise()])
        .find((candidate) => !usedPrompts.has(candidate.prompt));
    } else {
      const fresh = pool.filter((item) => !usedBank.has(item.prompt));
      const item = fresh.length ? sample(fresh, 1)[0] : sample(pool, 1)[0];
      usedBank.add(item.prompt);
      question = buildExercise(item);
    }
    if (!question || usedPrompts.has(question.prompt)) continue;
    usedPrompts.add(question.prompt);
    questions.push(question);
  }
  return questions;
}

/** Один случайный вопрос (для кнопки "ещё одно упражнение"). */
export function pickOne(topicId) {
  const allowGenerated = !topicId || topicId === 'past_simple';
  if (allowGenerated && Math.random() < 0.5) return generatedIrregularExercise();
  const pool = poolFor(topicId);
  return buildExercise(sample(pool, 1)[0]);
}

export function topicStatsText(topicId) {
  const topic = TOPIC_BY_ID.get(topicId);
  return topic ? `${topic.emoji} ${topic.title}` : '🎲 Микс заданий';
}

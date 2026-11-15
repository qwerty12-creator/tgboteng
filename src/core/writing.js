import * as db from '../db/index.js';
import { checkText, shortTips } from './grammarCheck.js';
import { mergeIssues } from './textReview.js';
import { escapeHtml } from './insights.js';

const CONNECTORS = [
  'because', 'so', 'but', 'however', 'although', 'though', 'while', 'also',
  'actually', 'finally', 'for example', 'in addition', 'moreover', 'as a result',
  'on the other hand', 'in my opinion',
];

const POSITIVE_WORDS = [
  'amazing', 'wonderful', 'delicious', 'fantastic', 'exciting', 'interesting',
  'lovely', 'perfect', 'great', 'happy', 'proud', 'useful', 'inspiring',
];

export function textMetrics(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).filter((part) => part.trim().length > 0);
  const lower = text.toLowerCase();
  return {
    words: words.length,
    sentences: Math.max(1, sentences.length),
    unique: new Set(words.map((word) => word.toLowerCase().replace(/[^a-z']/g, ''))).size,
    connectors: CONNECTORS.filter((connector) => lower.includes(connector)).length,
    positive: POSITIVE_WORDS.filter((word) => lower.includes(word)).length,
    avgSentence: words.length / Math.max(1, sentences.length),
  };
}

export function scoreText(metrics, issues) {
  const errorPenalty = Math.min(45, issues.total * 5);
  const lengthPenalty = metrics.words < 40 ? (40 - metrics.words) * 0.6 : 0;
  const varietyBonus = metrics.unique / Math.max(1, metrics.words) > 0.55 ? 5 : 0;
  const connectorBonus = Math.min(8, metrics.connectors * 2);
  const raw = 100 - errorPenalty - lengthPenalty + varietyBonus + connectorBonus;
  return Math.max(25, Math.min(100, Math.round(raw)));
}

function scoreLabel(score) {
  if (score >= 90) return 'отлично';
  if (score >= 75) return 'хорошо';
  if (score >= 60) return 'неплохо';
  return 'есть над чем поработать';
}

/** Проверяет текст, возвращает метрики, оценку и подробный фидбек. */
export function evaluateWriting(text, review = null) {
  const check = checkText(text);
  const metrics = textMetrics(text);
  const merged = mergeIssues(check.issues, review?.errors ?? []);
  const total = review ? merged.total : check.issues.reduce((sum, issue) => sum + (issue.hits ?? 1), 0);
  const corrected = review?.corrected ?? check.corrected;
  const score = scoreText(metrics, { total });
  const tips = shortTips(merged.issues, 3);
  const nonEnglish = Boolean(review?.language && review.language !== 'en');

  const lines = [];
  if (nonEnglish) {
    lines.push('🇷🇺 Текст не на английском — ищу ошибки и оцениваю только английский текст.', '');
  }
  lines.push(
    `📝 <b>Writing check</b> — <b>${score}/100</b> (${scoreLabel(score)})`,
    '',
    `Слов: ${metrics.words} · предложений: ${metrics.sentences} · уникальных слов: ${metrics.unique}`,
    `Средняя длина предложения: ${metrics.avgSentence.toFixed(1)}`,
  );

  if (tips.length) {
    lines.push('', '💡 <b>Что поправить</b>');
    for (const tip of tips) lines.push(`• ${escapeHtml(tip.text)}`);
  } else if (!nonEnglish) {
    lines.push('', '💡 Явных ошибок не нашёл. Попробуй усложнить структуру предложений.');
  }

  const notes = (review?.errors ?? []).map((error) => error.note).filter(Boolean).slice(0, 3);
  if (notes.length) {
    lines.push('', '🧠 <b>AI-проверка</b>');
    for (const note of notes) lines.push(`• ${escapeHtml(note)}`);
  }

  if (metrics.connectors >= 2) {
    lines.push('', '🔗 Хорошо используешь связки — текст читается легко.');
  } else {
    lines.push('', '🔗 Добавь связки (because, however, so) — текст станет плавнее.');
  }

  return {
    corrected,
    issues: merged.issues,
    issueTotal: total,
    metrics,
    score,
    feedback: lines.join('\n'),
  };
}

/** Сохраняет writing и возвращает результат для пользователя. */
export function submitWriting(userId, topic, text, options = {}) {
  const evaluation = evaluateWriting(text, options.review ?? null);
  const previous = db.recentWritingScores(userId, 5);
  const id = db.addWriting(userId, {
    topic,
    text,
    wordCount: evaluation.metrics.words,
    score: evaluation.score,
    feedback: evaluation.feedback,
  });
  for (const issue of evaluation.issues) {
    db.recordMistake(userId, {
      tag: issue.tag,
      title: issue.title,
      wrong: issue.wrong,
      right: issue.right,
    });
  }
  const avg = previous.length
    ? Math.round(previous.reduce((sum, row) => sum + row.score, 0) / previous.length)
    : null;
  return { id, ...evaluation, previousAverage: avg };
}

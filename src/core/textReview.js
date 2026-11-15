import { checkText } from './grammarCheck.js';
import { reviewText } from '../ai/reviewer.js';
import { XP_AWARDS } from './xp.js';
import { detectLanguage } from './language.js';

const norm = (value) => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Локальные ошибки + ошибки AI, без дублей по «wrong». */
export function mergeIssues(localIssues = [], aiErrors = []) {
  const issues = [...localIssues];
  const seen = new Set(localIssues.map((issue) => norm(issue.wrong)));
  let total = localIssues.reduce((sum, issue) => sum + (issue.hits ?? 1), 0);
  for (const error of aiErrors) {
    const wrong = norm(error.wrong);
    if (!wrong || seen.has(wrong)) continue;
    seen.add(wrong);
    issues.push({
      tag: 'ai_review',
      title: error.note || 'AI-проверка',
      reason: error.note,
      wrong: error.wrong,
      right: error.right,
      hits: 1,
    });
    total += 1;
  }
  return { issues, total };
}

/**
 * Проверка текста пользователя: локальные правила + AI-корректор (если ключ задан).
 * Если AI недоступен или ответ не разобрался — работают только локальные правила.
 * language: 'en' | 'mixed' | 'ru' — по нему решается, начислять ли XP
 * (см. rewardForReview) и что показать пользователю.
 * source: 'local' | 'ai' | 'hybrid'
 */
export async function reviewUserText(text, { level = 'A2', useAi = true } = {}) {
  // Язык определяем локально: результат детерминированный и не зависит от AI.
  const language = detectLanguage(text);
  const local = checkText(text);
  const ai = useAi ? await reviewText(text, { level }) : null;
  if (!ai) {
    return {
      language,
      corrected: local.corrected,
      issues: local.issues,
      issueTotal: local.issues.reduce((sum, issue) => sum + (issue.hits ?? 1), 0),
      aiErrors: [],
      source: 'local',
    };
  }
  const merged = mergeIssues(local.issues, ai.errors);
  return {
    language,
    corrected: ai.corrected ?? local.corrected,
    issues: merged.issues,
    issueTotal: merged.total,
    aiErrors: ai.errors,
    source: ai.errors.length ? 'hybrid' : 'ai',
  };
}

/** Есть ли замечания (любые — локальные или от AI). */
export function hasIssues(review) {
  return Boolean(review && review.issues && review.issues.length > 0);
}

/** Текст написан не на английском (полностью или частично). */
export function isNonEnglish(review) {
  return Boolean(review && review.language && review.language !== 'en');
}

/**
 * Английский вариант не-английского текста: «corrected» от AI, если он реально
 * на английском и отличается от исходного текста. Иначе — пустая строка.
 */
export function englishVariant(review, source = '') {
  const corrected = String(review?.corrected ?? '').trim();
  if (!corrected) return '';
  if (detectLanguage(corrected) === 'ru') return '';
  if (corrected.toLowerCase() === String(source ?? '').trim().toLowerCase()) return '';
  return corrected;
}

/**
 * Награда за текстовую работу (дневник, writing, сообщение в чате).
 * Есть хоть одна ошибка или текст не на английском — XP не начисляется,
 * но текст и ошибки сохраняются.
 * @returns {{xp:number}|{}} опции для award()
 */
export function rewardForReview(review) {
  return hasIssues(review) || isNonEnglish(review) ? { xp: XP_AWARDS.mistakes } : {};
}

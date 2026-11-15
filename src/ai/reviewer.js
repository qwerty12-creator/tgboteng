import { aiAvailable, chatCompletion } from './provider.js';
import { buildReviewPrompt } from './prompts.js';
import { MAX_REVIEW_ERRORS } from './correctionRules.js';

const MAX_TEXT = 2000;
const LANGUAGES = new Set(['en', 'ru', 'mixed']);
const norm = (value) => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Разбирает ответ модели. Возвращает null, если JSON не найден или битый.
 * Формат: { language, hasErrors, errors: [{ wrong, right, note }], corrected }
 * Дубли и «пустые» правки (right совпадает с wrong) отбрасываются.
 */
export function parseReviewResponse(raw) {
  const text = String(raw ?? '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  let data;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const errors = [];
  const seen = new Set();
  for (const item of Array.isArray(data.errors) ? data.errors : []) {
    const wrong = String(item?.wrong ?? '').trim();
    const right = String(item?.right ?? '').trim();
    const note = String(item?.note ?? '').trim();
    const key = norm(wrong);
    if (!key || !right || key === norm(right) || seen.has(key)) continue;
    seen.add(key);
    errors.push({ wrong, right, note });
    if (errors.length >= MAX_REVIEW_ERRORS) break;
  }
  const corrected = String(data.corrected ?? '').trim();
  const rawLanguage = String(data.language ?? '').toLowerCase();
  return {
    language: LANGUAGES.has(rawLanguage) ? rawLanguage : null,
    hasErrors: errors.length > 0,
    errors,
    corrected: corrected || null,
  };
}

/**
 * Проверка текста нейросетью. null — AI недоступен или ответ не разобрался,
 * тогда вызывающий код использует локальные правила.
 */
export async function reviewText(text, { level = 'A2' } = {}) {
  if (!aiAvailable()) return null;
  const source = String(text ?? '').trim().slice(0, MAX_TEXT);
  if (!source) return null;
  // Лимит ответа зависит от длины текста: corrected повторяет текст целиком,
  // на 400 токенах длинный JSON обрывался бы и проверка падала в локальный fallback.
  const maxTokens = Math.min(1200, 300 + source.length);
  try {
    const result = await chatCompletion(
      [
        { role: 'system', content: buildReviewPrompt({ level }) },
        { role: 'user', content: source },
      ],
      { temperature: 0, maxTokens },
    );
    return parseReviewResponse(result.text);
  } catch (error) {
    console.error('[ai] review failed:', error.message);
    return null;
  }
}

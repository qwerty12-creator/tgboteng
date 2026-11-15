/**
 * Определение языка сообщения без AI: считаем долю кириллицы среди букв.
 * Нужно, чтобы бот не начислял XP за текст не на английском, но всё равно
 * показывал разбор и английский вариант.
 */

/** Сколько букв латиницы и кириллицы в тексте (цифры, знаки и эмодзи не считаются). */
export function letterStats(text) {
  const source = String(text ?? '');
  const letters = source.match(/[A-Za-z\u0400-\u04FF]/g) ?? [];
  const cyrillic = source.match(/[\u0400-\u04FF]/g) ?? [];
  return {
    total: letters.length,
    cyrillic: cyrillic.length,
    share: letters.length ? cyrillic.length / letters.length : 0,
  };
}

/** Кириллицы больше этой доли — текст уже не английский. */
export const MIXED_SHARE = 0.2;

/** Кириллицы больше этой доли — текст целиком русский. */
export const RUSSIAN_SHARE = 0.8;

/**
 * Язык текста: 'en' — английский, 'mixed' — русский с вкраплениями английского,
 * 'ru' — целиком по-русски. Текст без букв (цифры, эмодзи) считаем английским:
 * ошибок в нём всё равно нет.
 */
export function detectLanguage(text) {
  const { total, share } = letterStats(text);
  if (!total) return 'en';
  if (share >= RUSSIAN_SHARE) return 'ru';
  if (share > MIXED_SHARE) return 'mixed';
  return 'en';
}

/** Текст написан на английском (ошибок и XP-блокировки по языку не будет). */
export function isEnglishText(text) {
  return detectLanguage(text) === 'en';
}

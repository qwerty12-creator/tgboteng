/**
 * Человекопонятная метка раздела бота. Нужна, чтобы AI-собеседник знал,
 * откуда пользователь написал: из меню, из грамматики, из повторения слов и т.д.
 * Чистый модуль без зависимостей — легко тестируется.
 */
const MODE_SECTIONS = {
  chat: 'AI Conversation (free talk)',
  diary: 'Diary (writing about the day)',
  word_add: 'Vocabulary (adding a new word)',
  grammar: 'Grammar practice (multiple-choice exercises)',
  review: 'Words review (flashcards)',
  writing: 'Writing (essay practice)',
};

/** Метка текущего раздела по состоянию пользователя (mode + payload). */
export function sectionLabel(state = {}) {
  const mode = String(state?.mode ?? '');
  const payload = state?.payload ?? {};
  const base = MODE_SECTIONS[mode] ?? 'Main menu (section picker)';

  if (mode === 'grammar' && Array.isArray(payload.questions) && payload.questions.length) {
    const index = Number(payload.index ?? 0);
    const topic = payload.questions[index]?.topicTitle;
    return `${base}, question ${index + 1}/${payload.questions.length}${topic ? ` (${topic})` : ''}`;
  }
  if (mode === 'writing' && payload.topic) return `${base}, topic "${payload.topic}"`;
  if (mode === 'review' && Number(payload.reviewed)) return `${base}, ${payload.reviewed} words done`;
  return base;
}

/** Режимы, в которых текст — это учебный материал, а не реплика в разговоре. */
const INPUT_MODES = new Set(['diary', 'word_add', 'writing']);

export function isInputMode(mode = '') {
  return INPUT_MODES.has(String(mode));
}
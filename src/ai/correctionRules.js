/**
 * Правила проверки ошибок — один источник правды для AI-корректора.
 * Используются в промпте проверки текста (дневник, writing, чат) и в офлайн-проверке:
 * что считать настоящей ошибкой и что ошибкой не считается.
 *
 * Политика награды: любая найденная ошибка → XP не начисляется (см. rewardForReview
 * в core/textReview.js), но ошибка запоминается в таблице mistakes.
 */

/** Настоящие ошибки: их бот исправляет и запоминает. */
export const MISTAKE_TYPES = [
  'wrong verb tense or verb form ("I go yesterday", "didn\'t went", "have went")',
  'subject-verb agreement ("he have a dog", "they is ready")',
  'missing third person -s ("he go to school every day")',
  'wrong word order ("I very like it", "she always is late")',
  'missing verb to be ("I tired", "my brother a student")',
  'wrong article when it breaks the meaning ("I am student", "I saw dog in park")',
  'wrong preposition or collocation ("depends of it", "listen music", "make a photo")',
  'uncountable nouns in plural ("informations", "advices", "homeworks")',
  'double negative and wrong quantifiers ("didn\'t do nothing", "much people")',
  'wrong comparative or superlative ("more better", "the most easiest")',
  'wrong pronoun or reflexive form ("me and my friend went", "he hurt hisself")',
];

/** Что ошибкой НЕ считается: за это XP не блокируется и статистика не растёт. */
export const NOT_MISTAKES = [
  'capital letters, lowercase "i" and sentence case',
  'punctuation, missing final dot, comma placement, emoji',
  'slang, contractions and informal style that are correct English',
  'a more natural alternative of a correct sentence (style, not an error)',
  'Russian words and Latin transliteration (the text is just not English)',
  'proper names and invented words',
];

/** Сколько ошибок максимум показываем и запоминаем за одну проверку. */
export const MAX_REVIEW_ERRORS = 5;

/** Ограничение длины пояснения к ошибке. */
export const NOTE_MAX_CHARS = 60;

/** Формат ответа модели: только JSON — по нему бот решает, начислять ли XP. */
export const REVIEW_CONTRACT = [
  'Reply with JSON only, no markdown, no comments, no code fences:',
  '{"language": "en", "hasErrors": true, "errors": [{"wrong": "didn\'t went", "right": "didn\'t go", "note": "после didn\'t нужна начальная форма"}], "corrected": "full text with fixes"}',
  '',
  'Rules for the answer:',
  `- At most ${MAX_REVIEW_ERRORS} errors, the most important first.`,
  '- "wrong" is copied exactly from the learner text.',
  '- "right" is only the fixed fragment and never equals "wrong".',
  '- Do not invent errors: if you are not sure, skip it.',
  '- "corrected" keeps the learner wording, only the mistakes are fixed.',
  `- "note" is a short explanation in Russian, up to ${NOTE_MAX_CHARS} characters.`,
  '- No mistakes found: {"language": "en", "hasErrors": false, "errors": [], "corrected": ""}.',
];

/** Блок правил для системного промпта корректора. */
export function buildCorrectionRules() {
  return [
    'What counts as a real mistake:',
    ...MISTAKE_TYPES.map((line) => `- ${line}`),
    '',
    'Never report these as mistakes:',
    ...NOT_MISTAKES.map((line) => `- ${line}`),
    '',
    'The "language" field:',
    '- English text: "language": "en", check it normally.',
    '- Russian text: "language": "ru", hasErrors=false, errors=[], and "corrected" holds a short natural English version of what the learner meant (1-2 sentences).',
    '- Russian mixed with English: "language": "mixed", report only real mistakes in the English parts and fix those parts in "corrected".',
  ].join('\n');
}

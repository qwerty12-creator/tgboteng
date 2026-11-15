import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewPrompt } from '../src/ai/prompts.js';
import { parseReviewResponse } from '../src/ai/reviewer.js';
import { buildCorrectionRules, MAX_REVIEW_ERRORS } from '../src/ai/correctionRules.js';
import { hasIssues, isNonEnglish, englishVariant, reviewUserText, rewardForReview } from '../src/core/textReview.js';
import { detectLanguage } from '../src/core/language.js';
import { formatChatReply } from '../src/core/conversation.js';
import { ensureUser, recordMistake, resetDbForTests } from '../src/db/index.js';
import { mistakeProfile } from '../src/core/insights.js';

test('buildReviewPrompt собирается из отдельного файла правил', () => {
  const prompt = buildReviewPrompt({ level: 'B1' });
  assert.match(prompt, /The learner level is B1/);
  assert.match(prompt, /What counts as a real mistake:/);
  assert.match(prompt, /Never report these as mistakes:/);
  assert.match(prompt, /capital letters, lowercase "i"/);
  assert.match(prompt, /Reply with JSON only/);
  assert.match(buildCorrectionRules(), /punctuation/);
});

test('parseReviewResponse: дубли и пустые правки отбрасываются', () => {
  const raw = JSON.stringify({
    hasErrors: true,
    errors: [
      { wrong: 'he have', right: 'he has', note: '3-е лицо' },
      { wrong: 'He have', right: 'He has', note: 'дубль' },
      { wrong: 'very like', right: 'very like', note: 'не правка' },
      { wrong: '', right: 'x' },
    ],
    corrected: 'He has a dog.',
  });
  const parsed = parseReviewResponse(raw);
  assert.equal(parsed.hasErrors, true);
  assert.equal(parsed.errors.length, 1);
  assert.equal(parsed.errors[0].right, 'he has');
});

test('parseReviewResponse: не больше MAX_REVIEW_ERRORS ошибок', () => {
  const errors = Array.from({ length: 9 }, (_, index) => ({ wrong: `w${index}`, right: `r${index}`, note: '' }));
  const parsed = parseReviewResponse(JSON.stringify({ hasErrors: true, errors, corrected: '' }));
  assert.equal(parsed.errors.length, MAX_REVIEW_ERRORS);
});

test('rewardForReview: ошибки блокируют XP, чистый текст — нет', () => {
  assert.deepEqual(rewardForReview(null), {});
  assert.deepEqual(rewardForReview({ issues: [] }), {});
  assert.deepEqual(rewardForReview({ issues: [{ tag: 'x', wrong: 'a', right: 'b' }] }), { xp: 0 });
  assert.equal(hasIssues({ issues: [{}] }), true);
  assert.equal(hasIssues({ issues: [] }), false);
});

test('ошибки упражнений попадают в профиль ошибок с темой', () => {
  resetDbForTests(':memory:');
  ensureUser({ id: 31, first_name: 'Learner' });
  recordMistake(31, { tag: 'grammar:articles', title: 'Артикли a / an / the', wrong: 'a', right: 'an' });
  const profile = mistakeProfile(31, 7, 5);
  assert.equal(profile.length, 1);
  assert.equal(profile[0].topic, 'articles');
  assert.equal(profile[0].count, 1);
  assert.equal(profile[0].right, 'an');
});

test('formatChatReply показывает исправленный вариант и подсказку', () => {
  const turn = {
    input: "I didn't went to school.",
    reply: 'Oh no, what happened?',
    tips: [{ tag: 'past_after_aux', text: "didn't went → didn't go" }],
    natural: [],
    review: {
      corrected: "I didn't go to school.",
      issues: [{ tag: 'past_after_aux', wrong: "didn't went", right: "didn't go" }],
    },
  };
  const text = formatChatReply(turn, { englishOnly: false });
  assert.match(text, /Исправлено/);
  assert.match(text, /didn't go to school/);
  assert.match(text, /didn't went → didn't go/);
});

test('detectLanguage: английский, русский и смешанный текст', () => {
  assert.equal(detectLanguage('I went to the park yesterday.'), 'en');
  assert.equal(detectLanguage('Вчера я ходил в парк с друзьями.'), 'ru');
  assert.equal(detectLanguage('Вчера we went в парк.'), 'mixed');
  assert.equal(detectLanguage('123 45 :)'), 'en');
  assert.equal(detectLanguage(''), 'en');
});

test('rewardForReview: русский текст блокирует XP', () => {
  const russian = { language: 'ru', issues: [], corrected: 'I am tired today.' };
  assert.equal(isNonEnglish(russian), true);
  assert.deepEqual(rewardForReview(russian), { xp: 0 });
  assert.deepEqual(rewardForReview({ language: 'mixed', issues: [] }), { xp: 0 });
  assert.deepEqual(rewardForReview({ language: 'en', issues: [] }), {});
  assert.equal(isNonEnglish({ issues: [] }), false);
});

test('englishVariant не показывает русский текст как английский', () => {
  assert.equal(englishVariant({ language: 'ru', corrected: 'I am tired today.' }, 'Я устал'), 'I am tired today.');
  assert.equal(englishVariant({ language: 'ru', corrected: 'Я устал' }, 'Я устал'), '');
  assert.equal(englishVariant({ language: 'ru', corrected: 'Я сильно устал' }, 'Я устал'), '');
  assert.equal(englishVariant({ corrected: 'Same text' }, 'Same text'), '');
});

test('parseReviewResponse сохраняет язык ответа', () => {
  const parsed = parseReviewResponse(JSON.stringify({
    language: 'ru',
    hasErrors: false,
    errors: [],
    corrected: 'I like this film.',
  }));
  assert.equal(parsed.language, 'ru');
  const fallback = parseReviewResponse(JSON.stringify({ language: 'de', hasErrors: false, errors: [] }));
  assert.equal(fallback.language, null);
});

test('reviewUserText: русский текст без ошибок, но с пометкой языка', async () => {
  const review = await reviewUserText('Мне очень нравится этот фильм.', { useAi: false });
  assert.equal(review.language, 'ru');
  assert.equal(review.issues.length, 0);
  assert.equal(hasIssues(review), false);
  assert.deepEqual(rewardForReview(review), { xp: 0 });
});

test('formatChatReply про русское сообщение: XP не начислен, есть английский вариант', () => {
  const text = formatChatReply({
    input: 'Я сегодня устал',
    reply: 'That sounds like a long day. What made it so tiring?',
    tips: [],
    natural: [],
    review: { language: 'ru', issues: [], corrected: 'I am tired today.' },
  }, { englishOnly: false });
  assert.match(text, /по-русски/);
  assert.match(text, /XP/);
  assert.match(text, /По-английски: I am tired today\./);
  assert.doesNotMatch(text, /Исправлено/);
});

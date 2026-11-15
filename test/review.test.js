import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReviewResponse } from '../src/ai/reviewer.js';
import { mergeIssues } from '../src/core/textReview.js';
import { checkText } from '../src/core/grammarCheck.js';

test('parseReviewResponse: достаёт JSON из ответа модели', () => {
  const raw = '```json\n{"hasErrors": true, "errors": [{"wrong": "he have", "right": "he has", "note": "3-е лицо"}], "corrected": "He has a dog."}\n```';
  const parsed = parseReviewResponse(raw);
  assert.equal(parsed.hasErrors, true);
  assert.equal(parsed.errors.length, 1);
  assert.equal(parsed.errors[0].right, 'he has');
  assert.equal(parsed.corrected, 'He has a dog.');
});

test('parseReviewResponse: без ошибок возвращает пустой список', () => {
  const parsed = parseReviewResponse('{"hasErrors": false, "errors": [], "corrected": ""}');
  assert.equal(parsed.hasErrors, false);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.corrected, null);
});

test('parseReviewResponse: битый ответ — null (fallback на локальные правила)', () => {
  assert.equal(parseReviewResponse('no json here'), null);
  assert.equal(parseReviewResponse(''), null);
  assert.equal(parseReviewResponse('{"hasErrors": true, "errors": ['), null);
});

test('parseReviewResponse: регистр и пунктуация не считаются ошибками', () => {
  const parsed = parseReviewResponse('{"hasErrors": false, "errors": [], "corrected": ""}');
  const check = checkText('i think it is fine');
  assert.equal(parsed.hasErrors, false);
  assert.equal(check.issues.length, 0);
});

test('mergeIssues: локальные и AI-ошибки объединяются без дублей', () => {
  const local = checkText('He have a dog.');
  const merged = mergeIssues(local.issues, [
    { wrong: 'He have', right: 'He has', note: '3-е лицо' },
    { wrong: 'a dog', right: 'the dog', note: 'артикль' },
  ]);
  assert.ok(merged.total >= 2);
  assert.ok(merged.issues.some((issue) => issue.tag === 'ai_review'));
});

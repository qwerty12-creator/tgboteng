import test from 'node:test';
import assert from 'node:assert/strict';
import { resetDbForTests, ensureUser, countWriting } from '../src/db/index.js';
import { evaluateWriting, submitWriting, textMetrics } from '../src/core/writing.js';

const GOOD_TEXT = 'Yesterday I went to a small cafe with my friend. We talked about our plans for the summer because we want to travel to Italy. The coffee was amazing, so we stayed there for two hours and the weather was lovely.';

test('textMetrics считает слова, предложения и связки', () => {
  const metrics = textMetrics(GOOD_TEXT);
  assert.ok(metrics.words > 30);
  assert.equal(metrics.sentences, 3);
  assert.ok(metrics.connectors >= 2);
});

test('evaluateWriting: чистый текст получает высокий балл', () => {
  const result = evaluateWriting(GOOD_TEXT);
  assert.ok(result.score >= 80, `score=${result.score}`);
  assert.equal(result.issueTotal, 0);
  assert.match(result.feedback, /Writing check/);
});

test('evaluateWriting: ошибки снижают балл и попадают в фидбек', () => {
  const bad = 'i didn\'t went to school yesterday because i was very tired and she have a lot of informations.';
  const result = evaluateWriting(bad);
  assert.ok(result.issueTotal >= 2);
  assert.ok(result.score < 80);
  assert.match(result.corrected, /didn't go/);
  assert.match(result.feedback, /Что поправить/);
});

test('evaluateWriting учитывает ошибки AI-проверки', () => {
  const review = {
    corrected: 'Yesterday I went to the park and saw a dog.',
    errors: [{ wrong: 'I go to the park and see', right: 'I went to the park and saw', note: 'Past Simple после yesterday' }],
  };
  const result = evaluateWriting('Yesterday I go to the park and see a dog.', review);
  assert.ok(result.issueTotal >= 1);
  assert.equal(result.corrected, review.corrected);
  assert.match(result.feedback, /AI-проверка/);
});

test('submitWriting сохраняет текст, оценку и ошибки', () => {
  resetDbForTests(':memory:');
  ensureUser({ id: 20, first_name: 'Writer' });
  const result = submitWriting(20, 'My day', 'I go to the park yesterday and I see a big dog. It was very friendly and I was happy.');
  assert.equal(countWriting(20), 1);
  assert.ok(result.score > 0 && result.score <= 100);
  assert.equal(result.previousAverage, null);

  const second = submitWriting(20, 'My day', GOOD_TEXT);
  assert.equal(second.previousAverage, result.score);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { resetDbForTests, ensureUser, getUser, addWord, recordMistake, addGoal, addDiaryEntry, addGrammarAttempt } from '../src/db/index.js';
import { activityBlocks, buildDashboard, goalValue, goalsText, progressBar } from '../src/core/dashboard.js';
import { weeklyInsight, mistakeProfile, recommendedTopic, dynamics } from '../src/core/insights.js';
import { localDate } from '../src/utils/date.js';

function freshUser(id = 30) {
  resetDbForTests(':memory:');
  return ensureUser({ id, first_name: 'Dash' });
}

test('activityBlocks: нули как точки, максимум как полный блок', () => {
  const blocks = activityBlocks([0, 1, 2, 0]);
  assert.equal(blocks.length, 4);
  assert.equal(blocks[0], '·');
  assert.equal(blocks[3], '·');
  assert.equal(blocks[2], '█');
});

test('progressBar заполняется пропорционально', () => {
  assert.equal(progressBar(0, 10), '░'.repeat(10));
  assert.equal(progressBar(100, 10), '█'.repeat(10));
  assert.equal(progressBar(50, 10), '█████░░░░░');
});

test('buildDashboard на пустом пользователе не падает и содержит все блоки', () => {
  const user = freshUser(31);
  const { text } = buildDashboard(user.id, user);
  assert.match(text, /YOUR ENGLISH JOURNEY/);
  assert.match(text, /График активности за месяц/);
  assert.match(text, /Новые слова/);
  assert.match(text, /Динамика/);
  assert.match(text, /Текущие цели/);
  assert.ok(text.includes('Practice days'));
  assert.ok(text.length < 4096);
});

test('buildDashboard отражает данные пользователя', () => {
  const user = freshUser(32);
  addDiaryEntry(user.id, 'Today I was happy and I went for a walk.', { wordCount: 10, mistakes: 0 });
  addWord(user.id, { word: 'exhausted', translation: 'истощённый' });
  addGrammarAttempt(user.id, { topic: 'articles', prompt: 'a apple?', given: 'a', answer: 'an', isCorrect: true });
  recordMistake(user.id, { tag: 'past_after_aux', title: 'Past Simple после did', wrong: "didn't went", right: "didn't go" });
  const { text } = buildDashboard(user.id, getUser(user.id));
  assert.match(text, /Words collected\s+1/);
  assert.match(text, /Частые грамматические ошибки/);
  assert.match(text, /didn't went/);
});

test('goalValue и goalsText работают с целями', () => {
  const user = freshUser(33);
  addGoal(user.id, { metric: 'words', title: 'Words collected', target: 10 });
  addWord(user.id, { word: 'brave' });
  assert.equal(goalValue(user.id, 'words'), 1);
  assert.match(goalsText(user.id), /1\/10/);
});

test('weeklyInsight без данных возвращает заглушку', () => {
  const user = freshUser(34);
  const insight = weeklyInsight(user.id);
  assert.equal(insight.hasData, false);
  assert.match(insight.text, /weekly insight/i);
});

test('weeklyInsight видит повторяющиеся ошибки и рекомендует тему', () => {
  const user = freshUser(35);
  recordMistake(user.id, { tag: 'past_after_aux', title: 'Past Simple после did', wrong: "didn't went", right: "didn't go" });
  recordMistake(user.id, { tag: 'past_after_aux', title: 'Past Simple после did' });
  const insight = weeklyInsight(user.id);
  assert.equal(insight.hasData, true);
  assert.match(insight.text, /irregular verbs|Past Simple/i);
  assert.equal(insight.currentCount, 2);

  const profile = mistakeProfile(user.id, 7);
  assert.equal(profile[0].tag, 'past_after_aux');
  assert.equal(profile[0].topic, 'past_simple');
  assert.ok(profile[0].practice.length > 0);

  const topic = recommendedTopic(user.id);
  assert.deepEqual(topic, { topic: 'past_simple', value: 2 });
});

test('dynamics сравнивает текущую неделю с прошлой', () => {
  const user = freshUser(36);
  addDiaryEntry(user.id, 'Test entry with several words inside.', { wordCount: 6 });
  const result = dynamics(user.id, localDate());
  assert.ok(result.current.diary >= 1);
  assert.equal(typeof result.delta.diary, 'number');
});

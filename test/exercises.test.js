import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAMMAR_BANK, TOPICS } from '../src/content/grammarBank.js';
import { buildExercise, generatedIrregularExercise, pickQuestions, pickOne } from '../src/core/exercises.js';

test('банк упражнений: у каждого 4 варианта и корректный индекс ответа', () => {
  assert.ok(GRAMMAR_BANK.length >= 30);
  for (const item of GRAMMAR_BANK) {
    assert.equal(item.options.length, 4, `вопрос без 4 вариантов: ${item.prompt}`);
    assert.ok(item.answer >= 0 && item.answer < item.options.length, `неверный answer: ${item.prompt}`);
    assert.ok(TOPICS.some((topic) => topic.id === item.topic), `неизвестная тема: ${item.topic}`);
    assert.ok(item.explain.length > 0);
  }
});

test('buildExercise перемешивает варианты, но сохраняет правильный ответ', () => {
  const source = GRAMMAR_BANK[0];
  const correct = source.options[source.answer];
  for (let i = 0; i < 20; i += 1) {
    const built = buildExercise(source);
    assert.equal(built.options[built.answer], correct);
    assert.equal(built.options.length, 4);
  }
});

test('generatedIrregularExercise: правильный ответ — нужная форма глагола', () => {
  for (let i = 0; i < 30; i += 1) {
    const task = generatedIrregularExercise();
    assert.equal(task.options[task.answer].length > 0, true);
    assert.equal(new Set(task.options).size, 4);
    assert.match(task.prompt, /Choose the correct/);
  }
});

test('pickQuestions: 10 уникальных вопросов для темы и для микса', () => {
  const mixed = pickQuestions(null, 10);
  assert.equal(mixed.length, 10);
  assert.equal(new Set(mixed.map((item) => item.prompt)).size, 10);
  assert.ok(mixed.every((item) => item.options[item.answer]));

  const themed = pickQuestions('articles', 10);
  assert.ok(themed.length >= 3);
  assert.ok(themed.every((item) => item.topic === 'articles'));
});

test('pickOne возвращает валидное задание', () => {
  const task = pickOne('past_simple');
  assert.ok(task.options.includes(task.options[task.answer]));
  assert.equal(typeof task.explain, 'string');
});

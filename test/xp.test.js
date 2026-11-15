import test from 'node:test';
import assert from 'node:assert/strict';
import { resetDbForTests, ensureUser, getUser, addDiaryEntry } from '../src/db/index.js';
import { LEVELS, levelFor, xpBar, XP_AWARDS } from '../src/core/xp.js';
import { award } from '../src/core/xp.js';
import { ACHIEVEMENTS, achievementList } from '../src/core/achievements.js';

test('levelFor: границы уровней', () => {
  assert.equal(levelFor(0).name, 'Beginner');
  assert.equal(levelFor(299).name, 'Beginner');
  assert.equal(levelFor(300).name, 'Explorer');
  assert.equal(levelFor(900).name, 'Intermediate');
  assert.equal(levelFor(2000).name, 'Advanced');
  assert.equal(levelFor(9999).name, 'Fluent');
  assert.equal(levelFor(9999).percent, 100);
});

test('levelFor: прогресс считается от текущего порога', () => {
  const level = levelFor(450);
  assert.equal(level.next, 900);
  assert.equal(level.toNext, 450);
  assert.equal(level.percent, 25);
});

test('xpBar рисует 12 символов', () => {
  const bar = xpBar(150, 12);
  assert.match(bar, /^[█░]{12} \d+%$/);
});

test('award: XP, стрик, дневной бонус и достижение First Entry', () => {
  resetDbForTests(':memory:');
  ensureUser({ id: 10, first_name: 'Tester' });
  addDiaryEntry(10, 'Today I went for a long walk and felt great.', { wordCount: 9, mistakes: 0 });

  const first = award(10, 'diary');
  assert.equal(first.xp, XP_AWARDS.diary + XP_AWARDS.dailyBonus + 50);
  assert.equal(first.streak, 1);
  assert.ok(first.unlocked.some((item) => item.code === 'first_entry'));
  assert.equal(getUser(10).xp, first.xp);

  const second = award(10, 'word');
  assert.equal(second.bonus, 0, 'дневной бонус только один раз в день');
  assert.equal(second.xp, XP_AWARDS.word);
});

test('award: при xp 0 не начисляет ни базовый XP, ни дневной бонус', () => {
  resetDbForTests(':memory:');
  ensureUser({ id: 12, first_name: 'Tester' });
  const result = award(12, 'diary', { xp: 0 });
  assert.equal(result.xp, 0);
  assert.equal(result.bonus, 0);
  assert.equal(getUser(12).xp, 0);
});

test('award: неверный ответ в грамматике не приносит XP', () => {
  resetDbForTests(':memory:');
  ensureUser({ id: 13, first_name: 'Tester' });
  const result = award(13, 'grammarWrong');
  assert.equal(XP_AWARDS.grammarWrong, 0);
  assert.equal(result.xp, 0);
  assert.equal(getUser(13).xp, 0);
});

test('achievementList: все достижения из ТЗ на месте', () => {
  resetDbForTests(':memory:');
  ensureUser({ id: 11, first_name: 'Tester' });
  const list = achievementList(11);
  assert.equal(list.length, ACHIEVEMENTS.length);
  const codes = list.map((item) => item.code);
  for (const code of ['first_entry', 'word_collector', 'streak_7', 'grammar_master', 'writing_lover', 'consistency']) {
    assert.ok(codes.includes(code), `нет достижения ${code}`);
  }
  assert.ok(list.every((item) => item.unlocked === false));
});

test('LEVELS: пять игровых уровней по возрастанию порога', () => {
  const mins = LEVELS.map((level) => level.min);
  assert.deepEqual(mins, [...mins].sort((a, b) => a - b));
  assert.equal(LEVELS.length, 5);
});

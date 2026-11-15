import test from 'node:test';
import assert from 'node:assert/strict';
import { checkText } from '../src/core/grammarCheck.js';

test('прошедшее время после did/didn\'t требует начальную форму', () => {
  const result = checkText('I didn\'t went to school yesterday.');
  assert.match(result.corrected, /didn't go to school/);
  const issue = result.issues.find((item) => item.tag === 'past_after_aux');
  assert.ok(issue, 'должна быть ошибка past_after_aux');
  assert.equal(issue.wrong, "didn't went");
  assert.equal(issue.right, "didn't go");
});

test('Present Perfect: после have нужна третья форма', () => {
  const result = checkText('I have went to London twice.');
  assert.match(result.corrected, /have gone to London/);
  assert.ok(result.issues.some((item) => item.tag === 'present_perfect_pp'));
});

test('маркер yesterday переводит глагол в Past Simple', () => {
  const result = checkText('Yesterday I go to the gym.');
  assert.match(result.corrected, /Yesterday I went to the gym/);
});

test('согласование he/she/it + have', () => {
  const result = checkText('She have two cats.');
  assert.equal(result.corrected, 'She has two cats.');
});

test('третье лицо: he go -> he goes', () => {
  const result = checkText('He go to work by bus.');
  assert.equal(result.corrected, 'He goes to work by bus.');
});

test('пропущенный to be', () => {
  const result = checkText('I very tired today.');
  assert.match(result.corrected, /I am very tired/);
});

test('артикль an перед гласным', () => {
  const result = checkText('She is a engineer.');
  assert.match(result.corrected, /an engineer/);
});

test('неисчисляемые существительные', () => {
  const result = checkText('Thank you for the informations.');
  assert.match(result.corrected, /information/);
});

test('предлоги: depend on и listen to', () => {
  const result = checkText('It depends of you and I like to listen music.');
  assert.match(result.corrected, /depends on you/);
  assert.match(result.corrected, /listen to music/);
});

test('в конце текста everyday становится every day', () => {
  const result = checkText('I practise English everyday');
  assert.match(result.corrected, /every day$/);
});

test('регистр букв не считается ошибкой', () => {
  const result = checkText('i think it is fine.');
  assert.equal(result.count, 0);
  assert.equal(result.corrected, 'i think it is fine.');
});

test('корректный текст не даёт ошибок', () => {
  const result = checkText('Yesterday I went to the cinema with my friends.');
  assert.equal(result.count, 0);
  assert.equal(result.corrected, 'Yesterday I went to the cinema with my friends.');
});

test('двойное отрицание заменяется на anything', () => {
  const result = checkText("I didn't see nothing interesting.");
  assert.match(result.corrected, /anything interesting/);
});

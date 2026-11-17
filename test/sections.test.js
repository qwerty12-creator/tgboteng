import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionLabel, isInputMode } from '../src/core/sections.js';

test('sectionLabel: меню и основные разделы', () => {
  assert.equal(sectionLabel(), 'Main menu (section picker)');
  assert.equal(sectionLabel({ mode: '', payload: {} }), 'Main menu (section picker)');
  assert.equal(sectionLabel({ mode: 'chat' }), 'AI Conversation (free talk)');
  assert.equal(sectionLabel({ mode: 'diary' }), 'Diary (writing about the day)');
});

test('sectionLabel: показывает прогресс внутри раздела', () => {
  const grammar = sectionLabel({
    mode: 'grammar',
    payload: { index: 1, questions: [{ topicTitle: 'Present Simple' }, { topicTitle: 'Past Simple' }] },
  });
  assert.equal(grammar, 'Grammar practice (multiple-choice exercises), question 2/2 (Past Simple)');
  assert.equal(
    sectionLabel({ mode: 'writing', payload: { topic: 'My day' } }),
    'Writing (essay practice), topic "My day"',
  );
  assert.equal(sectionLabel({ mode: 'review', payload: { reviewed: 3 } }), 'Words review (flashcards), 3 words done');
});

test('isInputMode: какие режимы забирают текст как учебный материал', () => {
  assert.equal(isInputMode('diary'), true);
  assert.equal(isInputMode('word_add'), true);
  assert.equal(isInputMode('writing'), true);
  assert.equal(isInputMode('chat'), false);
  assert.equal(isInputMode('grammar'), false);
  assert.equal(isInputMode(''), false);
});

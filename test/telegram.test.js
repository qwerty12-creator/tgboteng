import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { buildSystemPrompt } from '../src/ai/prompts.js';
import { getFile, isRetryableError } from '../src/telegram/api.js';

/** Подменяет fetch и токен на время теста, чтобы не ходить в Telegram. */
async function withStubbedTelegram(stub, run) {
  const originalFetch = globalThis.fetch;
  const originalToken = config.botToken;
  config.botToken = 'TEST_TOKEN';
  globalThis.fetch = stub;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
    config.botToken = originalToken;
  }
}

test('isRetryableError: сеть и 5xx повторяем, ошибки запроса — нет', () => {
  assert.equal(isRetryableError(null), false);
  assert.equal(isRetryableError(new TypeError('fetch failed')), true);
  const reset = new Error('socket hang up');
  reset.code = 'ECONNRESET';
  assert.equal(isRetryableError(reset), true);
  const server = new Error('Telegram sendMessage: Internal Server Error');
  server.code = 500;
  assert.equal(isRetryableError(server), true);
  const bad = new Error('Telegram sendMessage: Bad Request: chat not found');
  bad.code = 400;
  assert.equal(isRetryableError(bad), false);
});

test('getFile: повторяет запрос после сетевого сбоя и не теряет ответ', async () => {
  let calls = 0;
  const file = await withStubbedTelegram(async () => {
    calls += 1;
    if (calls === 1) throw new TypeError('fetch failed');
    return { status: 200, json: async () => ({ ok: true, result: { file_path: 'voice/file_1.oga' } }) };
  }, () => getFile('file_1'));
  assert.equal(calls, 2);
  assert.equal(file.file_path, 'voice/file_1.oga');
});

test('getFile: ошибку 400 не повторяет и пробрасывает наружу', async () => {
  let calls = 0;
  await withStubbedTelegram(async () => {
    calls += 1;
    return {
      status: 400,
      json: async () => ({ ok: false, error_code: 400, description: 'Bad Request: chat not found' }),
    };
  }, () => assert.rejects(() => getFile('file_1'), /chat not found/));
  assert.equal(calls, 1);
});

test('buildSystemPrompt: добавляет раздел и сохраняет пустые строки', () => {
  const withSection = buildSystemPrompt({ user: { level_hint: 'B1' }, section: 'Grammar practice, question 2/10' });
  assert.match(withSection, /bot section: Grammar practice, question 2\/10/);
  assert.match(withSection, /\n\nExample of the tone:/);

  const without = buildSystemPrompt({ user: { level_hint: 'B1' } });
  assert.doesNotMatch(without, /bot section:/);
  assert.match(without, /\n\nExample of the tone:/);
});

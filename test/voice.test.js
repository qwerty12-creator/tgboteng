import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveStt } from '../src/config.js';
import { asrErrorCode, asrSupportedMime, audioFileName, buildWhisperArgs, cleanTranscript, looksLikeSupportedScript, runProcess, transcribeViaApi } from '../src/ai/speech.js';

test('resolveStt по умолчанию берёт локальный whisper из своей папки проекта', () => {
  const stt = resolveStt({}, 'C:\\lingo');
  assert.equal(stt.whisperExe, path.join('C:\\lingo', 'whisper', 'Release', 'whisper-cli.exe'));
  assert.equal(stt.whisperModel, path.join('C:\\lingo', 'whisper', 'models', 'ggml-medium-q5_0.bin'));
  assert.equal(stt.language, 'auto');
  assert.equal(stt.ffmpeg, 'ffmpeg');
  assert.equal(stt.timeoutMs, 600000);
  assert.equal(stt.apiKey, '');
  assert.equal(stt.apiBaseUrl, 'https://api.deepseek.com/v1');
  assert.equal(stt.apiPath, '/tools/asr');
  assert.equal(stt.maxBytes, 8 * 1024 * 1024);
  assert.equal(stt.maxSeconds, 120);
});

test('resolveStt: облачный ASR берёт ключ AI_API_KEY и настройки STT_*', () => {
  const stt = resolveStt({ AI_API_KEY: 'sk-ai', STT_API_KEY: 'sk-stt', STT_BASE_URL: 'https://api.deepseek.com/v1/' });
  assert.equal(stt.apiKey, 'sk-stt');
  assert.equal(stt.apiBaseUrl, 'https://api.deepseek.com/v1');
  assert.equal(resolveStt({ AI_API_KEY: 'sk-ai' }).apiKey, 'sk-ai');
  const custom = resolveStt({ STT_BASE_URL: 'https://example.test/v1', STT_API_PATH: '/asr', STT_MAX_BYTES: '1024', STT_MAX_SECONDS: '30' });
  assert.equal(custom.apiBaseUrl, 'https://example.test/v1');
  assert.equal(custom.apiPath, '/asr');
  assert.equal(custom.maxBytes, 1024);
  assert.equal(custom.maxSeconds, 30);
});

test('resolveStt: явные пути и настройки из env имеют приоритет', () => {
  const stt = resolveStt({
    WHISPER_EXE: 'D:\\tools\\whisper-cli.exe',
    WHISPER_MODEL: 'D:\\models\\small.bin',
    WHISPER_LANG: 'en',
    WHISPER_THREADS: '2',
    WHISPER_TIMEOUT_MS: '90000',
    FFMPEG: 'C:\\ffmpeg\\bin\\ffmpeg.exe',
  });
  assert.equal(stt.whisperExe, 'D:\\tools\\whisper-cli.exe');
  assert.equal(stt.whisperModel, 'D:\\models\\small.bin');
  assert.equal(stt.language, 'en');
  assert.equal(stt.threads, 2);
  assert.equal(stt.timeoutMs, 90000);
  assert.equal(stt.ffmpeg, 'C:\\ffmpeg\\bin\\ffmpeg.exe');
});

test('resolveStt берёт существующий whisper из соседних папок (ds-bot)', () => {
  const stt = resolveStt();
  assert.match(stt.whisperExe, /whisper-cli\.exe$/);
  assert.match(stt.whisperModel, /ggml-medium-q5_0\.bin$/);
});

test('audioFileName подбирает расширение по mime-типу', () => {
  assert.equal(audioFileName('audio/ogg'), 'voice.ogg');
  assert.equal(audioFileName('audio/mpeg'), 'voice.mp3');
  assert.equal(audioFileName('audio/mp4'), 'voice.m4a');
  assert.equal(audioFileName(''), 'voice.ogg');
  assert.equal(audioFileName('audio/unknown'), 'voice.ogg');
});

test('buildWhisperArgs собирает команду whisper-cli (текст из stdout)', () => {
  const args = buildWhisperArgs({
    model: 'D:\\m\\ggml.bin',
    language: 'ru',
    threads: 4,
    wav: 'C:\\tmp\\voice.wav',
  });
  assert.deepEqual(args, [
    '-m',
    'D:\\m\\ggml.bin',
    '-l',
    'ru',
    '-t',
    '4',
    '-f',
    'C:\\tmp\\voice.wav',
    '-nt',
    '-np',
  ]);
  assert.equal(buildWhisperArgs({ model: 'm', threads: 1, wav: 'w' })[3], 'auto');
});

test('cleanTranscript убирает маркеры тишины и склеивает строки', () => {
  assert.equal(cleanTranscript('  Hello   world \r\n\r\n[BLANK_AUDIO]\n'), 'Hello world');
  assert.equal(cleanTranscript('(music)\nI am learning English'), 'I am learning English');
  assert.equal(cleanTranscript(''), '');
  assert.equal(cleanTranscript(null), '');
});

test('runProcess возвращает stdout и падает на ненулевом коде', async () => {
  const out = await runProcess(process.execPath, ['-e', 'process.stdout.write("hi")'], 20000);
  assert.equal(out, 'hi');
  await assert.rejects(() => runProcess(process.execPath, ['-e', 'process.exit(3)'], 20000), /код 3/);
});

/* --------------------------------------------- облачный ASR (DeepSeek) */

const ASR_SETTINGS = {
  apiKey: 'test-key',
  apiBaseUrl: 'https://api.deepseek.com/v1',
  apiPath: '/tools/asr',
  maxBytes: 8 * 1024 * 1024,
  maxSeconds: 120,
  apiTimeoutMs: 5000,
};

const asrAudio = (overrides = {}) => ({
  buffer: Buffer.from('OggS-fake-audio'),
  mimeType: 'audio/ogg',
  fileName: 'voice.ogg',
  ...overrides,
});

test('asrSupportedMime: только ogg/opus и wav', () => {
  assert.equal(asrSupportedMime('audio/ogg'), true);
  assert.equal(asrSupportedMime('audio/OGG'), true);
  assert.equal(asrSupportedMime('audio/wav'), true);
  assert.equal(asrSupportedMime('audio/mpeg'), false);
  assert.equal(asrSupportedMime('audio/mp4'), false);
  assert.equal(asrSupportedMime(''), false);
});

test('asrErrorCode переводит статусы в понятные коды', () => {
  assert.equal(asrErrorCode(400), 'STT_BAD_FORMAT');
  assert.equal(asrErrorCode(408), 'STT_TIMEOUT');
  assert.equal(asrErrorCode(413), 'STT_TOO_LARGE');
  assert.equal(asrErrorCode(429), 'STT_BUSY');
  assert.equal(asrErrorCode(503), 'STT_BUSY');
  assert.equal(asrErrorCode(504), 'STT_BUSY');
  assert.equal(asrErrorCode(500), 'STT_HTTP_500');
});

test('transcribeViaApi отправляет ogg в DeepSeek ASR и чистит транскрипт', async () => {
  let called = null;
  const fetchImpl = async (url, init) => {
    called = { url, init };
    return new Response(JSON.stringify({ request_id: 'r1', text: '  Hello   world \n[BLANK_AUDIO]', duration_ms: 1500 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const result = await transcribeViaApi(asrAudio(), { fetchImpl, settings: ASR_SETTINGS });
  assert.deepEqual(result, { text: 'Hello world', provider: 'deepseek-asr' });
  assert.equal(called.url, 'https://api.deepseek.com/v1/tools/asr');
  assert.equal(called.init.method, 'POST');
  assert.equal(called.init.headers.Authorization, 'Bearer test-key');
  assert.ok(called.init.body instanceof FormData);
  assert.equal(called.init.body.get('file').name, 'voice.ogg');
});

test('transcribeViaApi: ошибки HTTP и лимиты не пропускаются молча', async () => {
  const fetchImpl = async () => new Response('bad audio', { status: 413 });
  await assert.rejects(
    () => transcribeViaApi(asrAudio(), { fetchImpl, settings: ASR_SETTINGS }),
    /STT_TOO_LARGE/,
  );

  const busy = async () => new Response('busy', { status: 429 });
  await assert.rejects(() => transcribeViaApi(asrAudio(), { fetchImpl: busy, settings: ASR_SETTINGS }), /STT_BUSY/);

  await assert.rejects(
    () => transcribeViaApi(asrAudio({ mimeType: 'audio/mpeg' }), { fetchImpl, settings: ASR_SETTINGS }),
    /STT_BAD_FORMAT/,
  );

  await assert.rejects(
    () => transcribeViaApi(asrAudio({ buffer: Buffer.alloc(32) }), { fetchImpl, settings: { ...ASR_SETTINGS, maxBytes: 8 } }),
    /STT_TOO_LARGE/,
  );

  const empty = async () => new Response(JSON.stringify({ text: '   ' }), { status: 200 });
  await assert.rejects(() => transcribeViaApi(asrAudio(), { fetchImpl: empty, settings: ASR_SETTINGS }), /STT_EMPTY_RESPONSE/);

  // У DeepSeek ASR нет параметра language: на короткой записи автодетект иногда
  // выдаёт китайский, и такой транскрипт нельзя показывать как «услышанное».
  const foreign = async () =>
    new Response(JSON.stringify({ request_id: 'r2', text: '就不是叫。', duration_ms: 900 }), { status: 200 });
  await assert.rejects(
    () => transcribeViaApi(asrAudio(), { fetchImpl: foreign, settings: ASR_SETTINGS }),
    /STT_UNEXPECTED_SCRIPT/,
  );
});

test('looksLikeSupportedScript: латиница и кириллица проходят, иероглифы — нет', () => {
  assert.equal(looksLikeSupportedScript('Hello world!'), true);
  assert.equal(looksLikeSupportedScript('Привет, как дела? 42'), true);
  assert.equal(looksLikeSupportedScript("I'm fine — thanks 🙂"), true);
  assert.equal(looksLikeSupportedScript('就不是叫。'), false);
  assert.equal(looksLikeSupportedScript('こんにちは'), false);
  assert.equal(looksLikeSupportedScript(''), false);
});


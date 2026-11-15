import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveStt } from '../src/config.js';
import { audioFileName, buildWhisperArgs, cleanTranscript, runProcess } from '../src/ai/speech.js';

test('resolveStt по умолчанию берёт локальный whisper из своей папки проекта', () => {
  const stt = resolveStt({}, 'C:\\lingo');
  assert.equal(stt.whisperExe, path.join('C:\\lingo', 'whisper', 'Release', 'whisper-cli.exe'));
  assert.equal(stt.whisperModel, path.join('C:\\lingo', 'whisper', 'models', 'ggml-medium-q5_0.bin'));
  assert.equal(stt.language, 'auto');
  assert.equal(stt.ffmpeg, 'ffmpeg');
  assert.equal(stt.timeoutMs, 600000);
  assert.equal(stt.apiKey, undefined);
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


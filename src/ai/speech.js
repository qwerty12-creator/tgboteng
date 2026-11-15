import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config, hasStt } from '../config.js';

/** Локальное распознавание доступно: whisper.cpp и модель найдены. */
export function sttAvailable() {
  return hasStt();
}

/** Что именно не найдено — для понятного сообщения пользователю. */
export function sttProblem() {
  if (!config.stt.whisperExe) return 'не задан путь к whisper-cli.exe';
  if (!existsSync(config.stt.whisperExe)) return `не найден ${config.stt.whisperExe}`;
  if (!config.stt.whisperModel) return 'не задан путь к модели whisper';
  if (!existsSync(config.stt.whisperModel)) return `не найдена модель ${config.stt.whisperModel}`;
  return '';
}

const FILE_NAMES = {
  'audio/ogg': 'voice.ogg',
  'audio/oga': 'voice.ogg',
  'audio/opus': 'voice.ogg',
  'audio/mpeg': 'voice.mp3',
  'audio/mp3': 'voice.mp3',
  'audio/mp4': 'voice.m4a',
  'audio/x-m4a': 'voice.m4a',
  'audio/m4a': 'voice.m4a',
  'audio/wav': 'voice.wav',
  'audio/x-wav': 'voice.wav',
  'audio/webm': 'voice.webm',
  'audio/flac': 'voice.flac',
};

/** Имя временного файла: ffmpeg и whisper ориентируются на расширение. */
export function audioFileName(mimeType = '') {
  return FILE_NAMES[String(mimeType).toLowerCase()] ?? 'voice.ogg';
}

/**
 * Аргументы whisper-cli. Пишем не в файл (`-otxt` в этом билде падает на записи),
 * а читаем текст из stdout: `-nt` убирает таймкоды, `-np` — служебные принты.
 */
export function buildWhisperArgs({ model, language, threads, wav }) {
  return ['-m', model, '-l', language || 'auto', '-t', String(threads), '-f', wav, '-nt', '-np'];
}

/** Чистит вывод whisper: пустые строки и служебные маркеры тишины/музыки. */
export function cleanTranscript(raw) {
  return String(raw ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\[[^\]]*\]$/.test(line) && !/^\([^)]*\)$/.test(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Запуск внешнего процесса с таймаутом (ffmpeg, whisper-cli). */
export function runProcess(command, args, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* уже завершился */
      }
      reject(new Error('превышено время выполнения'));
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk).slice(-2000);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`${path.basename(command)}: код ${code} ${stderr.slice(-300)}`));
    });
  });
}

/**
 * Распознаёт речь локально: аудио → WAV 16 кГц моно (ffmpeg) → whisper.cpp.
 * Ничего не уходит в сеть, ключи не нужны.
 */
export async function transcribeAudio(audio, options = {}) {
  if (!sttAvailable()) throw new Error(`STT_DISABLED: ${sttProblem()}`);

  const settings = config.stt;
  const dir = mkdtempSync(path.join(os.tmpdir(), 'lingo-stt-'));
  const src = path.join(dir, audio.fileName || audioFileName(audio.mimeType));
  const wav = `${src}.16k.wav`;

  try {
    writeFileSync(src, audio.buffer);
    await runProcess(settings.ffmpeg, ['-y', '-i', src, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav], 120000);
    const stdout = await runProcess(
      settings.whisperExe,
      buildWhisperArgs({
        model: settings.whisperModel,
        language: options.language ?? settings.language,
        threads: settings.threads,
        wav,
      }),
      settings.timeoutMs,
    );
    const text = cleanTranscript(stdout);
    if (!text) throw new Error('STT_EMPTY_RESPONSE');
    return { text, provider: 'whisper.cpp' };
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  }
}


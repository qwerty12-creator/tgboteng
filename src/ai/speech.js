import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config, hasLocalStt, hasRemoteStt, sttMode } from '../config.js';

/** Локальное распознавание доступно: whisper.cpp и модель найдены. */
export function sttAvailable() {
  return hasLocalStt() || hasRemoteStt();
}

/** Что именно не найдено — для понятного сообщения пользователю. */
export function sttProblem() {
  if (sttMode() === 'api') return '';
  if (!config.stt.whisperExe) return 'не задан путь к whisper-cli.exe';
  if (!existsSync(config.stt.whisperExe)) return `не найден ${config.stt.whisperExe}`;
  if (!config.stt.whisperModel) return 'не задан путь к модели whisper';
  if (!existsSync(config.stt.whisperModel)) return `не найдена модель ${config.stt.whisperModel}`;
  if (!hasRemoteStt()) return 'нет ни whisper.cpp, ни ключа DeepSeek (AI_API_KEY/STT_API_KEY)';
  return '';
}

/** Текущий режим и лимиты — для сообщений в чате. */
export function sttLimits() {
  return {
    mode: sttMode(),
    maxBytes: config.stt.maxBytes,
    maxSeconds: config.stt.maxSeconds,
  };
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

/* ------------------------------------------------- облачное распознавание */

/** DeepSeek ASR принимает только 16-bit PCM WAV и Ogg Opus (формат голосовых Telegram). */
const ASR_MIME_TYPES = new Set(['audio/ogg', 'audio/oga', 'audio/opus', 'audio/wav', 'audio/x-wav']);

export function asrSupportedMime(mimeType = '') {
  return ASR_MIME_TYPES.has(String(mimeType).toLowerCase());
}

/** HTTP-статус ASR → код причины: в чат не показываем, пишем в лог. */
export function asrErrorCode(status) {
  if (status === 400) return 'STT_BAD_FORMAT';
  if (status === 408) return 'STT_TIMEOUT';
  if (status === 413) return 'STT_TOO_LARGE';
  if (status === 429 || status === 503 || status === 504) return 'STT_BUSY';
  return `STT_HTTP_${status}`;
}

/**
 * Распознаёт речь в облаке: DeepSeek ASR (POST /v1/tools/asr).
 * Файл уходит целиком, язык определяется автоматически, лимиты — 8 МиБ и 120 с.
 * Ключ тот же, что у AI (или STT_API_KEY), endpoint — STT_BASE_URL.
 */
export async function transcribeViaApi(audio, options = {}) {
  const settings = { ...config.stt, ...(options.settings ?? {}) };
  const fetchImpl = options.fetchImpl ?? fetch;
  const mimeType = String(audio.mimeType ?? '').toLowerCase();

  if (!asrSupportedMime(mimeType)) throw new Error(`STT_BAD_FORMAT: ${mimeType || 'unknown'}`);
  if (audio.buffer.length > settings.maxBytes) throw new Error('STT_TOO_LARGE');

  const form = new FormData();
  form.append('file', new Blob([audio.buffer], { type: mimeType }), audio.fileName || audioFileName(mimeType));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.apiTimeoutMs);
  try {
    const response = await fetchImpl(`${settings.apiBaseUrl}${settings.apiPath}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${settings.apiKey}` },
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`${asrErrorCode(response.status)}: ${body.slice(0, 200)}`);
    }
    const data = await response.json();
    const text = cleanTranscript(data?.text ?? '');
    if (!text) {
      // В чат это не уходит: детали нужны только в логах Render, чтобы понять,
      // сервис не разобрал речь (duration_ms > 0) или получил битое аудио (0).
      const details = [
        `request_id=${data?.request_id ?? '-'}`,
        `duration_ms=${data?.duration_ms ?? '-'}`,
        `bytes=${audio.buffer.length}`,
        `mime=${mimeType || 'unknown'}`,
      ].join(' ');
      throw new Error(`STT_EMPTY_RESPONSE ${details}`);
    }
    return { text, provider: 'deepseek-asr' };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('STT_TIMEOUT');
    throw error;
  } finally {
    clearTimeout(timer);
  }
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
  // Локального whisper нет (например, Render) — распознаём в облаке DeepSeek.
  if (!hasLocalStt()) return transcribeViaApi(audio, options);

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


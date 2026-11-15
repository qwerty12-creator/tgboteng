import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Минималистичный загрузчик .env без внешних зависимостей.
 * Уже заданные переменные окружения имеют приоритет.
 */
export function loadEnvFile(filePath = path.join(ROOT_DIR, '.env')) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
  return true;
}

loadEnvFile();

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** Явный путь из env берём как есть, иначе — первый существующий из кандидатов. */
const pickPath = (explicit, candidates) => explicit || candidates.find((file) => fs.existsSync(file)) || candidates[0];

/**
 * Локальное распознавание речи: whisper.cpp + ffmpeg. Ключи не нужны,
 * аудио никуда не отправляется. Бинарник и модель ищутся в своём проекте
 * (`whisper/`), затем в соседнем `ds-bot/whisper/`; при необходимости
 * переопределяются через WHISPER_EXE / WHISPER_MODEL.
 */
export function resolveStt(env = process.env, root = ROOT_DIR) {
  // 1) своя папка whisper/, 2) ds-bot рядом, 3) ds-bot уровнем выше (c:\AI-Workspace\ds-bot)
  const whisperRoots = [
    root,
    path.join(path.dirname(root), 'ds-bot'),
    path.join(path.dirname(path.dirname(root)), 'ds-bot'),
  ];
  const whisperExe = pickPath(
    env.WHISPER_EXE,
    whisperRoots.map((dir) => path.join(dir, 'whisper', 'Release', 'whisper-cli.exe')),
  );
  const whisperModel = pickPath(
    env.WHISPER_MODEL,
    whisperRoots.map((dir) => path.join(dir, 'whisper', 'models', 'ggml-medium-q5_0.bin')),
  );
  return {
    whisperExe,
    whisperModel,
    language: env.WHISPER_LANG || 'auto',
    ffmpeg: env.FFMPEG || 'ffmpeg',
    threads: num(env.WHISPER_THREADS, Math.min(4, os.cpus().length)),
    timeoutMs: num(env.WHISPER_TIMEOUT_MS, 600000),
  };
}

export const config = {
  botToken: process.env.BOT_TOKEN || '',
  tzOffset: num(process.env.TZ_OFFSET, 3),
  dbPath: process.env.DB_PATH || path.join(ROOT_DIR, 'data', 'lingo.db'),
  ai: {
    apiKey: process.env.AI_API_KEY || '',
    baseUrl: (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    timeoutMs: num(process.env.AI_TIMEOUT_MS, 25000),
  },
  stt: resolveStt(),
  pollTimeoutSec: 30,
  version: '1.0.0',
};

export const hasAi = () => Boolean(config.ai.apiKey && !config.ai.apiKey.includes('*'));

/** Локальное распознавание готово: найдены whisper-cli.exe и модель. */
export const hasStt = () =>
  Boolean(config.stt.whisperExe && config.stt.whisperModel) &&
  fs.existsSync(config.stt.whisperExe) &&
  fs.existsSync(config.stt.whisperModel);

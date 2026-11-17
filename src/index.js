import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { config, sttMode } from './config.js';
import { openDb, closeDb } from './db/index.js';
import { getMe, getUpdates, setMyCommands } from './telegram/api.js';
import { handleUpdate } from './bot/app.js';

let offset = 0;
let running = true;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * PID-файл: start/stop/status в scripts\bot-ctl.ps1 ищут бота по нему.
 * Пишет сам процесс — WMI на этой машине не работает, командную строку
 * процессов прочитать нельзя, поэтому файл — единственный надёжный источник.
 */
const PID_FILE = path.resolve('run', 'bot.pid');

function writePidFile() {
  try {
    mkdirSync(path.dirname(PID_FILE), { recursive: true });
    writeFileSync(PID_FILE, String(process.pid), 'utf8');
  } catch (error) {
    console.error('[pid] не удалось записать', PID_FILE, error.message);
  }
}

function clearPidFile() {
  try {
    if (readFileSync(PID_FILE, 'utf8').trim() === String(process.pid)) rmSync(PID_FILE, { force: true });
  } catch {
    /* файла нет — значит уже удалён */
  }
}

/**
 * Health-сервер для PaaS (Render и подобных): web service обязан слушать порт
 * из PORT, иначе деплой падает с «no open ports detected». Локально PORT не
 * задан — сервер не поднимается и поведение бота не меняется. Любой GET
 * отвечает 200, поэтому внешний пинг (cron-job.org, UptimeRobot) не даёт
 * бесплатному инстансу заснуть.
 */
function startHealthServer() {
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port <= 0) return null;
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(`ok uptime=${Math.round(process.uptime())}s\n`);
  });
  server.on('error', (error) => console.error('[http] health-сервер:', error.message));
  server.listen(port, '0.0.0.0', () => console.log(`[http] health-сервер: 0.0.0.0:${port}`));
  return server;
}

async function poll() {
  while (running) {
    try {
      const updates = await getUpdates(offset, config.pollTimeoutSec);
      if (!updates.length) continue;
      // Подтверждаем пачку сразу, чтобы не получить дубли при долгой обработке.
      offset = Math.max(...updates.map((update) => update.update_id)) + 1;
      for (const update of updates) {
        await handleUpdate(update);
      }
    } catch (error) {
      const description = error.description ?? error.message ?? String(error);
      if (/terminated by other getUpdates/i.test(description)) {
        console.error('[poll] другой экземпляр бота уже слушает Telegram. Останови его и перезапусти.');
        running = false;
        break;
      }
      if (error.name === 'AbortError') continue;
      console.error('[poll]', description);
      await sleep(3000);
    }
  }
}

/**
 * Стартовый getMe с ожиданием сети: если Telegram недоступен (VPN выключен,
 * провайдер режет доступ), бот не падает, а повторяет попытку раз в 10 секунд.
 * Неверный токен (Telegram ответил ошибкой) — сразу выход с понятным логом.
 */
async function waitForTelegram() {
  for (;;) {
    try {
      return await getMe();
    } catch (error) {
      const description = error.description ?? error.message ?? String(error);
      const answered = Boolean(error.description);
      const retryable = !answered || /too many requests/i.test(description);
      if (!retryable) {
        console.error('[bot] Telegram отклонил запрос:', description);
        process.exit(1);
      }
      console.error(`[bot] Telegram недоступен (${description}). Повтор через 10 с...`);
      await sleep(10000);
    }
  }
}

async function main() {
  if (!config.botToken) {
    console.error('BOT_TOKEN не задан. Скопируй .env.example в .env и вставь токен от @BotFather.');
    process.exit(1);
  }

  openDb();
  writePidFile();
  console.log(`[db] ${config.dbPath}`);
  const healthServer = startHealthServer();
  const me = await waitForTelegram();
  console.log(`[bot] запущен: @${me.username} (${me.first_name})`);
  try {
    await setMyCommands();
  } catch (error) {
    console.error('[bot] не удалось обновить меню команд:', error.message);
  }
  console.log(`[ai] ${config.ai.apiKey ? `подключён (${config.ai.model})` : 'офлайн-режим'}`);
  const voiceMode = sttMode();
  console.log(
    voiceMode === 'local'
      ? `[stt] голосовые: локальный whisper.cpp (${config.stt.whisperModel})`
      : voiceMode === 'api'
        ? `[stt] голосовые: DeepSeek ASR (${config.stt.apiBaseUrl}${config.stt.apiPath})`
        : '[stt] голосовые выключены: нет whisper.cpp и не задан ключ AI_API_KEY/STT_API_KEY',
  );

  const shutdown = (signal) => {
    console.log(`\n[bot] ${signal}: завершаю работу`);
    running = false;
    healthServer?.close();
    closeDb();
    clearPidFile();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('exit', clearPidFile);
  process.on('unhandledRejection', (reason) => console.error('[unhandled]', reason));

  await poll();
}

main().catch((error) => {
  console.error('[fatal]', error);
  process.exit(1);
});

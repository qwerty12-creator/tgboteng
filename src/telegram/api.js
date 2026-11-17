import { config } from '../config.js';

const MAX_LENGTH = 4000;

function endpoint() {
  if (!config.botToken) throw new Error('BOT_TOKEN is not set. Add it to .env');
  return `https://api.telegram.org/bot${config.botToken}`;
}

const NETWORK_ERROR = /fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|network|aborted/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Сетевой сбой или временная ошибка сервера Telegram: запрос имеет смысл повторить.
 * Раньше на Render `fetch failed` терял готовый ответ бота — пользователь видел
 * «Распознаю речь…», а сообщение с результатом не приходило.
 */
export function isRetryableError(error) {
  if (!error) return false;
  const code = Number(error.code);
  if (Number.isFinite(code) && (code === 429 || code >= 500)) return true;
  if (error.name === 'AbortError' || error.name === 'TimeoutError') return true;
  return NETWORK_ERROR.test(String(error.message ?? error));
}

async function callApi(method, payload = {}, { timeoutMs = 40000, retries = 3 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${endpoint()}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!data || !data.ok) {
        const description = data?.description ?? `HTTP ${response.status}`;
        const error = new Error(`Telegram ${method}: ${description}`);
        error.description = description;
        error.code = data?.error_code ?? response.status;
        error.retryAfter = data?.parameters?.retry_after;
        throw error;
      }
      return data.result;
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isRetryableError(error)) throw error;
      const delay = error.retryAfter ? error.retryAfter * 1000 : 300 * attempt;
      console.warn(`[tg] ${method}: ${error.message} — повтор ${attempt + 1}/${retries} через ${delay} мс`);
      await sleep(delay);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

/** Режет длинный текст по строкам, чтобы не превысить лимит Telegram. */
export function splitMessage(text, limit = MAX_LENGTH) {
  const source = String(text ?? '');
  if (source.length <= limit) return [source];
  const chunks = [];
  let current = '';
  for (const line of source.split('\n')) {
    if (current.length + line.length + 1 > limit) {
      if (current) chunks.push(current);
      if (line.length > limit) {
        for (let i = 0; i < line.length; i += limit) chunks.push(line.slice(i, i + limit));
        current = '';
        continue;
      }
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function basePayload(chatId, text, extra = {}) {
  return {
    chat_id: chatId,
    text,
    link_preview_options: { is_disabled: true },
    ...extra,
  };
}

/**
 * Отправляет сообщение (при необходимости несколькими частями)
 * и мягко откатывается на plain text, если Telegram не разобрал HTML.
 */
export async function sendMessage(chatId, text, extra = {}) {
  const parseMode = extra.parse_mode ?? 'HTML';
  const chunks = splitMessage(text);
  let last = null;
  for (const chunk of chunks) {
    const payload = basePayload(chatId, chunk, { ...extra, parse_mode: parseMode });
    try {
      last = await callApi('sendMessage', payload);
    } catch (error) {
      if (parseMode && /parse/i.test(error.description ?? '')) {
        const plain = basePayload(chatId, chunk, { ...extra, parse_mode: undefined });
        last = await callApi('sendMessage', plain);
      } else {
        throw error;
      }
    }
  }
  return last;
}

export async function editMessageText(chatId, messageId, text, extra = {}) {
  const parseMode = extra.parse_mode ?? 'HTML';
  const payload = { chat_id: chatId, message_id: messageId, text, ...extra, parse_mode: parseMode };
  try {
    return await callApi('editMessageText', payload);
  } catch (error) {
    if (/message is not modified/i.test(error.description ?? '')) return null;
    if (parseMode && /parse/i.test(error.description ?? '')) {
      return callApi('editMessageText', { ...payload, parse_mode: undefined });
    }
    throw error;
  }
}

export function answerCallbackQuery(id, text = '', showAlert = false) {
  return callApi('answerCallbackQuery', { callback_query_id: id, text, show_alert: showAlert })
    .catch((error) => console.error('[tg] answerCallbackQuery:', error.message));
}

export function sendChatAction(chatId, action = 'typing') {
  return callApi('sendChatAction', { chat_id: chatId, action }).catch(() => null);
}

export function deleteMessage(chatId, messageId) {
  return callApi('deleteMessage', { chat_id: chatId, message_id: messageId }).catch(() => null);
}

export function getMe() {
  return callApi('getMe');
}

/** Информация о файле (для голосовых: file_path нужен, чтобы скачать). */
export function getFile(fileId) {
  return callApi('getFile', { file_id: fileId });
}

/** Скачивает файл бота из Telegram и возвращает Buffer. */
export async function downloadFile(filePath, { timeoutMs = 60000 } = {}) {
  if (!config.botToken) throw new Error('BOT_TOKEN is not set. Add it to .env');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`https://api.telegram.org/file/bot${config.botToken}/${filePath}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Telegram file: HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

export async function getUpdates(offset = 0, timeout = config.pollTimeoutSec) {
  return callApi('getUpdates', {
    offset,
    timeout,
    allowed_updates: ['message', 'callback_query'],
  }, { timeoutMs: (timeout + 15) * 1000 });
}

export function setMyCommands() {
  return callApi('setMyCommands', {
    commands: [
      { command: 'menu', description: 'Главное меню' },
      { command: 'diary', description: 'Запись в дневник' },
      { command: 'words', description: 'Мои слова' },
      { command: 'grammar', description: 'Грамматика' },
      { command: 'writing', description: 'Writing practice' },
      { command: 'chat', description: 'AI conversation' },
      { command: 'dashboard', description: 'Статистика и прогресс' },
      { command: 'insight', description: 'Анализ ошибок за неделю' },
      { command: 'help', description: 'Как пользоваться ботом' },
    ],
  }).catch((error) => console.error('[tg] setMyCommands:', error.message));
}

export { callApi };

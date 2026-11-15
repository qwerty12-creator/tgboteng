import { config, hasAi } from '../config.js';

export function aiAvailable() {
  return hasAi();
}

export function aiInfo() {
  return aiAvailable()
    ? { enabled: true, model: config.ai.model, baseUrl: config.ai.baseUrl }
    : { enabled: false, model: null, baseUrl: null };
}

/**
 * Запрос к OpenAI-совместимому chat/completions.
 * Бросает исключение при любой проблеме: вызывающий код делает fallback.
 */
export async function chatCompletion(messages, options = {}) {
  if (!aiAvailable()) throw new Error('AI_DISABLED');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);
  try {
    const response = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model,
        messages,
        temperature: options.temperature ?? 0.85,
        max_tokens: options.maxTokens ?? 220,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`AI_HTTP_${response.status}: ${body.slice(0, 200)}`);
    }
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('AI_EMPTY_RESPONSE');
    return { text, provider: config.ai.model };
  } finally {
    clearTimeout(timer);
  }
}

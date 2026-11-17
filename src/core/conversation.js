import * as db from '../db/index.js';
import { aiAvailable, chatCompletion } from '../ai/provider.js';
import { localChatReply } from '../ai/localChat.js';
import { buildSystemPrompt } from '../ai/prompts.js';
import { shortTips } from './grammarCheck.js';
import { reviewUserText, isNonEnglish, englishVariant } from './textReview.js';
import { naturalSuggestions } from '../content/phrases.js';
import { escapeHtml, mistakeProfile } from './insights.js';

/**
 * Один ход разговора: проверка ошибок (локальные правила + AI), ответ AI (или офлайн),
 * сохранение истории. Ошибки запоминаются, а решение про XP принимает вызывающий код
 * через rewardForReview(review).
 */
export async function conversationTurn(user, userText, { section = '' } = {}) {
  const history = db.chatHistory(user.id, 12);
  const mistakes = mistakeProfile(user.id, 30, 4).map((item) => item.title);
  // Проверка ошибок идёт параллельно с ответом модели, чтобы не удваивать ожидание.
  const reviewPromise = reviewUserText(userText, { level: user.level_hint });
  const natural = naturalSuggestions(userText, 1);

  db.addChatMessage(user.id, 'user', userText);

  let reply = '';
  let provider = 'local';
  let fallbackReason = null;

  if (aiAvailable()) {
    try {
      const messages = [
        {
          role: 'system',
          content: buildSystemPrompt({
            user,
            mistakes,
            englishOnly: Boolean(user.english_only),
            section,
          }),
        },
        ...history.map((row) => ({ role: row.role === 'assistant' ? 'assistant' : 'user', content: row.text })),
        { role: 'user', content: userText },
      ];
      const result = await chatCompletion(messages, { maxTokens: 220 });
      reply = result.text;
      provider = result.provider;
    } catch (error) {
      fallbackReason = error.message;
      console.error('[ai] fallback to local chat:', error.message);
    }
  }

  if (!reply) {
    reply = localChatReply(userText, { level: user.level_hint });
    provider = 'local';
  }

  const review = await reviewPromise;
  const tips = shortTips(review.issues, 2);
  for (const issue of review.issues) {
    db.recordMistake(user.id, {
      tag: issue.tag,
      title: issue.title,
      wrong: issue.wrong,
      right: issue.right,
    });
  }

  db.addChatMessage(user.id, 'assistant', reply);
  return { input: userText, reply, provider, tips, natural, fallbackReason, review };
}

/** Сообщение для Telegram: ответ + исправление и ненавязчивые подсказки внизу. */
export function formatChatReply(turn, { englishOnly = true } = {}) {
  const lines = [escapeHtml(turn.reply)];
  const input = String(turn.input ?? '').trim();
  const review = turn.review ?? {};
  const hasErrors = (review.issues ?? []).length > 0;
  const corrected = String(review.corrected ?? '').trim();
  if (isNonEnglish(review)) {
    // Русский текст не засчитываем (XP не начисляется, см. rewardForReview),
    // но показываем, что не так, и как сказать это по-английски.
    const note = review.language === 'ru'
      ? (englishOnly
        ? '🇷🇺 You wrote in Russian — no XP for this message. Try to say it in English.'
        : '🇷🇺 Ты написал по-русски — XP за это сообщение не начислен. Попробуй сказать это по-английски.')
      : (englishOnly
        ? '🇷🇺 The message has Russian words — no XP for it. Please write in English.'
        : '🇷🇺 В сообщении есть русский текст — XP за него не начислен. Пиши по-английски.');
    lines.push('', note);
    const variant = englishVariant(review, input);
    if (variant) {
      const label = englishOnly ? 'In English' : 'По-английски';
      lines.push('', `🇬🇧 <i>${label}: ${escapeHtml(variant)}</i>`);
    }
  } else if (hasErrors && corrected && corrected.toLowerCase() !== input.toLowerCase()) {
    const label = englishOnly ? 'Corrected' : 'Исправлено';
    lines.push('', `✍️ <i>${label}: ${escapeHtml(corrected)}</i>`);
  }
  const notes = [];
  for (const tip of turn.tips) {
    if (tip.text) notes.push(`💡 <i>${escapeHtml(tip.text)}</i>`);
  }
  for (const item of turn.natural ?? []) {
    const label = englishOnly ? 'Sounds more natural' : 'Естественнее';
    notes.push(`🌟 <i>${label}: ${escapeHtml(item.suggestion)}</i>`);
  }
  if (notes.length) {
    lines.push('', ...notes.slice(0, 3));
  }
  return lines.join('\n');
}

export function chatIntro() {
  return [
    '<b>08 · AI Conversation</b>',
    '',
    'Отдельный режим общения на английском. Просто пиши боту — он поддержит разговор, подстроится под уровень и будет мягко показывать более естественные варианты.',
    '',
    'Пример:',
    '<i>You: Today I was very tired because I had many lessons.</i>',
    '<i>LINGO: That sounds exhausting! Which lesson was the most difficult today?</i>',
    '',
    'Команды внутри чата: /english — только английский, /level — уровень, /endchat — выйти, /menu — меню.',
    '',
    aiAvailable()
      ? 'AI подключён: ответы генерирует модель.'
      : 'AI-ключ не задан, работает встроенный офлайн-собеседник. Добавь AI_API_KEY в .env — и подключится нейросеть.',
  ].join('\n');
}

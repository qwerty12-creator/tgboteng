import * as db from '../db/index.js';
import * as tg from '../telegram/api.js';
import * as kb from './keyboards.js';
import * as texts from './texts.js';
import { award } from '../core/xp.js';
import { shortTips } from '../core/grammarCheck.js';
import { reviewUserText, hasIssues, isNonEnglish, englishVariant, rewardForReview } from '../core/textReview.js';
import { naturalSuggestions } from '../content/phrases.js';
import { escapeHtml, weeklyInsight, recommendedTopic } from '../core/insights.js';
import { buildDashboard, goalsText, GOAL_METRICS, METRIC_TITLE } from '../core/dashboard.js';
import { achievementList } from '../core/achievements.js';
import { submitWriting } from '../core/writing.js';
import { pickWritingTopic } from '../content/writingTopics.js';
import { TOPIC_BY_ID } from '../content/grammarBank.js';
import { pickQuestions } from '../core/exercises.js';
import { conversationTurn, formatChatReply } from '../core/conversation.js';
import { aiAvailable } from '../ai/provider.js';
import { sttAvailable, sttProblem, transcribeAudio } from '../ai/speech.js';

const DEFAULT_GOAL_TARGETS = { diary: 20, words: 100, grammar: 50, practiceDays: 30, writing: 20 };

function rewardLines(result) {
  const lines = [];
  if (result.xp) {
    lines.push(`✨ +${result.xp} XP${result.bonus ? ` (бонус дня +${result.bonus})` : ''}`);
  }
  if (result.streak > 1) lines.push(`🔥 Стрик: ${result.streak} дн.`);
  for (const item of result.unlocked ?? []) {
    lines.push(`${item.emoji} Достижение: <b>${item.title}</b> (+50 XP)`);
  }
  if (result.levelUp) lines.push(`${result.levelUp.to.emoji} Новый уровень: <b>${result.levelUp.to.name}</b>!`);
  return lines;
}

function tipsBlock(issues, limit = 3) {
  const tips = shortTips(issues, limit);
  if (!tips.length) return [];
  return ['💡 <b>Что можно улучшить</b>', ...tips.map((tip) => `• ${escapeHtml(tip.text)}`)];
}

function userStatsSafe(userId) {
  return db.userStats(userId);
}

/* --------------------------------------------------------------- updates */

export async function handleUpdate(update) {
  try {
    if (update.message) return await onMessage(update.message);
    if (update.callback_query) return await onCallback(update.callback_query);
    return null;
  } catch (error) {
    console.error('[bot] update failed:', error.message);
    return null;
  }
}

async function onMessage(message) {
  const from = message.from;
  if (!from || from.is_bot) return null;
  const chatId = message.chat.id;
  const user = db.ensureUser(from);

  // Голосовые и аудио: сначала распознаём речь, дальше — как обычный текст.
  if (message.voice || message.audio) return handleVoice(user, chatId, message);

  const text = (message.text ?? '').trim();
  if (!text) {
    return tg.sendMessage(chatId, 'Пока я понимаю текст и голосовые 🙂 Напиши сообщение, запиши голосовое или выбери раздел в меню.', {
      reply_markup: kb.mainMenu(),
    });
  }

  return routeText(user, chatId, text);
}

/** Общая маршрутизация текста (набранного или распознанного) по текущему режиму. */
async function routeText(user, chatId, text) {
  if (text.startsWith('/')) return onCommand(user, chatId, text);

  const state = db.getState(user.id);
  switch (state.mode) {
    case 'diary':
      return saveDiary(user, chatId, text);
    case 'word_add':
      return saveWord(user, chatId, text);
    case 'chat':
      return chatTurn(user, chatId, text);
    case 'writing':
      return saveWriting(user, chatId, text, state.payload);
    default:
      return tg.sendMessage(
        chatId,
        ['Текст принят, но сейчас мы не в разделе с вводом.', '', 'Выбери, что сделать:', '• 📖 Дневник — записать день', '• 💬 AI Conversation — поговорить', '• ✍️ Writing — написать текст'].join('\n'),
        { reply_markup: kb.mainMenu() },
      );
  }
}

/* ---------------------------------------------------------- голосовые */

const MAX_VOICE_BYTES = 20 * 1024 * 1024;

async function handleVoice(user, chatId, message) {
  const media = message.voice ?? message.audio;

  if (!sttAvailable()) {
    return tg.sendMessage(
      chatId,
      [
        '🎧 Голосовые пока не подключены.',
        '',
        `Причина: <i>${escapeHtml(sttProblem() || 'не найдены файлы whisper.cpp')}</i>`,
        '',
        'Нужны локальные whisper.cpp и ffmpeg: положи папку <code>whisper/</code> рядом с проектом',
        'или укажи пути в <code>.env</code> — <code>WHISPER_EXE</code>, <code>WHISPER_MODEL</code>, <code>FFMPEG</code>.',
        '',
        'А пока можно написать то же самое текстом 🙂',
      ].join('\n'),
      { reply_markup: kb.mainMenu() },
    );
  }

  if (media.file_size && media.file_size > MAX_VOICE_BYTES) {
    return tg.sendMessage(chatId, 'Голосовое слишком большое: Telegram не отдаёт ботам файлы больше 20 МБ. Разбей его на части.');
  }

  await tg.sendMessage(chatId, '🎤 Слушаю и распознаю локально — обычно это занимает меньше минуты…');
  await tg.sendChatAction(chatId, 'typing');
  try {
    const file = await tg.getFile(media.file_id);
    if (!file?.file_path) throw new Error('Telegram не вернул путь к файлу');
    const buffer = await tg.downloadFile(file.file_path);
    const { text } = await transcribeAudio({ buffer, mimeType: media.mime_type });
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) throw new Error('речь не распознана');
    await tg.sendMessage(chatId, `🎧 <b>Услышал:</b> <i>${escapeHtml(clean)}</i>`);
    return routeText(user, chatId, clean);
  } catch (error) {
    const reason = String(error?.message ?? error).slice(0, 160);
    console.error('[voice]', reason);
    return tg.sendMessage(
      chatId,
      ['Не получилось разобрать голосовое 😔', `<i>${escapeHtml(reason)}</i>`, '', 'Можно написать это текстом — проверю так же.'].join('\n'),
      { reply_markup: kb.mainMenu() },
    );
  }
}

async function onCommand(user, chatId, raw) {
  const [command, ...rest] = raw.split(/\s+/);
  const arg = rest.join(' ');
  switch (command.toLowerCase().split('@')[0]) {
    case '/start': {
      db.clearState(user.id);
      await tg.sendMessage(chatId, texts.startText(user, user.isNew), { reply_markup: kb.mainMenu() });
      return null;
    }
    case '/menu':
      db.clearState(user.id);
      return tg.sendMessage(chatId, texts.menuText(user, userStatsSafe(user.id)), { reply_markup: kb.mainMenu() });
    case '/help':
      return tg.sendMessage(chatId, texts.HELP_TEXT, { reply_markup: kb.mainMenu() });
    case '/diary':
      return openDiary(user, chatId);
    case '/words':
      return openWords(user, chatId);
    case '/grammar':
      return openGrammar(chatId);
    case '/writing':
      return openWriting(chatId);
    case '/chat':
      return openChat(user, chatId);
    case '/dashboard':
      return sendDashboard(user, chatId);
    case '/insight':
      return sendInsight(user, chatId);
    case '/achievements':
    case '/ach':
      return sendAchievements(user, chatId);
    case '/goals':
      return sendGoals(user, chatId);
    case '/settings':
      return sendSettings(user, chatId);
    case '/english':
      return toggleEnglish(user, chatId);
    case '/level':
      return arg ? setLevel(user, chatId, arg.toUpperCase()) : sendLevelMenu(user, chatId);
    case '/endchat':
      db.clearState(user.id);
      return tg.sendMessage(chatId, 'Вышли из разговора. Возвращайся, когда захочешь поболтать 👋', {
        reply_markup: kb.mainMenu(),
      });
    case '/id':
      return tg.sendMessage(chatId, `Твой ID: <code>${user.id}</code>`);
    default:
      return tg.sendMessage(chatId, 'Неизвестная команда. Открой /menu — там всё есть.', {
        reply_markup: kb.mainMenu(),
      });
  }
}

/* ------------------------------------------------------- открытие меню */

async function openDiary(user, chatId) {
  db.setState(user.id, 'diary', {});
  return tg.sendMessage(chatId, texts.DIARY_TEXT, {
    reply_markup: kb.diaryKeyboard(),
    parse_mode: 'HTML',
  });
}

async function openWords(user, chatId) {
  const due = db.countDueWords(user.id);
  return tg.sendMessage(chatId, texts.WORDS_TEXT, { reply_markup: kb.wordsMenu(due) });
}

function openGrammar(chatId) {
  return tg.sendMessage(chatId, texts.GRAMMAR_TEXT, { reply_markup: kb.grammarMenu() });
}

function openWriting(chatId) {
  return tg.sendMessage(chatId, texts.WRITING_TEXT, { reply_markup: kb.writingMenu() });
}

async function openChat(user, chatId) {
  db.setState(user.id, 'chat', {});
  return tg.sendMessage(chatId, texts.chatReadyText(aiAvailable()), { reply_markup: kb.chatKeyboard() });
}

/* ------------------------------------------------------------ дневник */

async function saveDiary(user, chatId, text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 3) {
    return tg.sendMessage(chatId, 'Слишком коротко — напиши хотя бы 3–4 слова. Например: <i>Today I was tired but happy.</i>');
  }
  const review = await reviewUserText(text, { level: user.level_hint });
  const issues = review.issues;
  const hasErrors = hasIssues(review);
  const nonEnglish = isNonEnglish(review);
  db.addDiaryEntry(user.id, text, { wordCount: words, mistakes: issues.length });
  for (const issue of issues) {
    db.recordMistake(user.id, { tag: issue.tag, title: issue.title, wrong: issue.wrong, right: issue.right });
  }
  db.clearState(user.id);
  // Ошибки есть или текст не на английском — запись сохраняется, но XP не начисляется.
  const reward = award(user.id, 'diary', rewardForReview(review));
  const natural = naturalSuggestions(text, 1);

  const parts = ['<b>📖 Запись сохранена</b>', '', `Слов: ${words} · найдено замечаний: ${issues.length}`];
  if (hasErrors) {
    parts.push('');
    parts.push(...tipsBlock(issues, 3));
    parts.push('', '⚠️ Есть замечания — XP за эту запись не начислен.');
  }
  if (nonEnglish) {
    parts.push('', review.language === 'ru'
      ? '🇷🇺 Запись на русском — XP за неё не начислен: ошибки ищу в английском тексте.'
      : '🇷🇺 В записи есть русский текст — пиши по-английски, иначе XP не начисляется.');
  }
  const variant = nonEnglish ? englishVariant(review, text) : '';
  if (variant) {
    parts.push('', '🇬🇧 <b>Как это по-английски</b>', `<i>${escapeHtml(variant)}</i>`);
  } else if (hasErrors) {
    const corrected = String(review.corrected ?? '');
    if (corrected && corrected.toLowerCase() !== text.trim().toLowerCase()) {
      parts.push('', '✍️ <b>Как это выглядит исправленным</b>', `<i>${escapeHtml(corrected)}</i>`);
    }
  }
  if (!hasErrors && !nonEnglish) {
    parts.push('', '✨ Явных ошибок не нашёл — отличная работа!');
  }
  for (const item of natural) parts.push(`🌟 <i>${escapeHtml(item.suggestion)}</i>`);
  const rewards = rewardLines(reward);
  if (rewards.length) parts.push('', ...rewards);

  return tg.sendMessage(chatId, parts.join('\n'), { reply_markup: kb.diaryKeyboard() });
}

/* -------------------------------------------------------------- слова */

async function saveWord(user, chatId, text) {
  const separator = text.match(/\s+[-—–:=]\s+/);
  let word = text;
  let translation = '';
  if (separator) {
    const index = separator.index ?? 0;
    word = text.slice(0, index).trim();
    translation = text.slice(index + separator[0].length).trim();
  }
  if (!word || word.length > 64) {
    return tg.sendMessage(chatId, 'Не понял слово. Формат: <code>word - перевод</code>, например <code>exhausted - истощённый</code>.');
  }
  const saved = db.addWord(user.id, { word, translation });
  if (saved.duplicate) {
    db.clearState(user.id);
    return tg.sendMessage(
      chatId,
      `Слово <b>${escapeHtml(saved.word)}</b> уже в словаре (повторено ${saved.correct + saved.wrong} раз).\n\nМожно повторить его кнопкой 🔁 в разделе «Слова».`,
      { reply_markup: kb.wordsMenu(db.countDueWords(user.id)) },
    );
  }
  db.clearState(user.id);
  const reward = award(user.id, 'word');
  const parts = [
    '<b>📝 Слово добавлено</b>',
    '',
    `<b>${escapeHtml(saved.word)}</b>${saved.translation ? ` — ${escapeHtml(saved.translation)}` : ''}`,
    'Первый повтор — завтра.',
  ];
  const rewards = rewardLines(reward);
  if (rewards.length) parts.push('', ...rewards);
  parts.push('', 'Добавить ещё? Просто отправь следующее слово.');
  db.setState(user.id, 'word_add', {});
  return tg.sendMessage(chatId, parts.join('\n'), { reply_markup: kb.wordsMenu(db.countDueWords(user.id)) });
}

/* ----------------------------------------------------------- AI-чат */

async function chatTurn(user, chatId, text) {
  await tg.sendChatAction(chatId, 'typing');
  const turn = await conversationTurn(user, text);
  // Проверка гибридная: локальные правила + AI-корректор.
  // Есть замечания или текст не на английском — XP за ход не начисляется.
  const hasErrors = hasIssues(turn.review);
  const nonEnglish = isNonEnglish(turn.review);
  const reward = award(user.id, 'chat', rewardForReview(turn.review));
  const parts = [formatChatReply(turn, { englishOnly: Boolean(user.english_only) })];
  // Для не-английского текст про XP уже сказал formatChatReply — не дублируем.
  if (hasErrors && !nonEnglish) parts.push('', '⚠️ Есть замечания — XP за это сообщение не начислен.');
  const rewards = rewardLines(reward).filter((line) => !line.includes('Стрик'));
  if (rewards.length) parts.push('', ...rewards);
  return tg.sendMessage(chatId, parts.join('\n'), { reply_markup: kb.chatKeyboard() });
}

/* ---------------------------------------------------------- грамматика */

function questionText(payload) {
  const question = payload.questions[payload.index];
  return [
    `<b>🎯 ${escapeHtml(question.topicTitle)}</b> · ${payload.index + 1}/${payload.questions.length}`,
    '',
    question.prompt,
  ].join('\n');
}

async function startGrammarSession(user, chatId, topicId = 'mix') {
  const actual = topicId === 'mix' ? null : topicId;
  const questions = pickQuestions(actual, 10);
  if (!questions.length) {
    return tg.sendMessage(chatId, 'Не удалось собрать упражнения — попробуй другую тему.', {
      reply_markup: kb.grammarMenu(),
    });
  }
  const payload = { topicId: actual ?? 'mix', index: 0, correct: 0, total: 0, answered: false, questions };
  db.setState(user.id, 'grammar', payload);
  return tg.sendMessage(chatId, questionText(payload), {
    reply_markup: kb.exerciseKeyboard(questions[0].options, 0),
  });
}

async function grammarAnswer(user, chatId, messageId, index, choice) {
  const state = db.getState(user.id);
  const payload = state.payload;
  if (state.mode !== 'grammar' || !payload.questions) {
    return { alert: 'Сессия устарела — открой раздел «Грамматика» заново.' };
  }
  if (payload.answered) return { alert: 'Ответ уже дан — нажми «Следующее».' };
  if (index !== payload.index) return { alert: 'Этот вопрос уже неактуален.' };

  const question = payload.questions[index];
  const chosen = question.options[Number(choice)];
  if (chosen === undefined) return { alert: 'Такого варианта ответа нет.' };
  const isCorrect = Number(choice) === question.answer;
  db.addGrammarAttempt(user.id, {
    topic: question.topic,
    prompt: question.prompt,
    given: chosen,
    answer: question.options[question.answer],
    isCorrect,
  });
  // Неверный ответ запоминаем как ошибку: она попадёт в insight и в рекомендации.
  if (!isCorrect) {
    db.recordMistake(user.id, {
      tag: `grammar:${question.topic}`,
      title: question.topicTitle,
      wrong: chosen,
      right: question.options[question.answer],
    });
  }

  payload.correct += isCorrect ? 1 : 0;
  payload.total += 1;
  payload.answered = true;
  db.setState(user.id, 'grammar', payload);

  const reward = award(user.id, isCorrect ? 'grammarCorrect' : 'grammarWrong');
  const lines = [
    `<b>🎯 ${escapeHtml(question.topicTitle)}</b> · ${index + 1}/${payload.questions.length}`,
    '',
    question.prompt,
    '',
    isCorrect ? '✅ <b>Верно!</b>' : `❌ Правильный ответ: <b>${escapeHtml(question.options[question.answer])}</b>`,
    `<i>${escapeHtml(question.explain)}</i>`,
  ];
  if (!isCorrect) lines.push('', '⚠️ За ошибку XP не начисляется — зато теперь ты знаешь правило.');
  const rewards = rewardLines(reward).filter((line) => !line.includes('Стрик'));
  if (rewards.length) lines.push('', ...rewards);

  const hasNext = index + 1 < payload.questions.length;
  return tg.editMessageText(chatId, messageId, lines.join('\n'), {
    reply_markup: kb.afterAnswerKeyboard(hasNext),
  });
}

async function grammarNext(user, chatId, messageId) {
  const state = db.getState(user.id);
  const payload = state.payload;
  if (state.mode !== 'grammar' || !payload.questions) {
    return tg.sendMessage(chatId, 'Сессия устарела. Открой раздел «Грамматика» заново.', { reply_markup: kb.grammarMenu() });
  }
  const nextIndex = payload.index + 1;
  if (nextIndex >= payload.questions.length) return grammarFinish(user, chatId, messageId);
  payload.index = nextIndex;
  payload.answered = false;
  db.setState(user.id, 'grammar', payload);
  const question = payload.questions[nextIndex];
  return tg.editMessageText(chatId, messageId, questionText(payload), {
    reply_markup: kb.exerciseKeyboard(question.options, nextIndex),
  });
}

async function grammarFinish(user, chatId, messageId) {
  const state = db.getState(user.id);
  if (state.mode !== 'grammar' || !state.payload?.questions) {
    return { alert: 'Сессия уже завершена — открой раздел «Грамматика» заново.' };
  }
  const payload = state.payload;
  const total = payload.total ?? 0;
  const correct = payload.correct ?? 0;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  db.clearState(user.id);

  const lines = [
    '<b>🏁 Тренировка завершена</b>',
    '',
    `Верно: <b>${correct}</b> из <b>${total}</b> · точность ${accuracy}%`,
  ];
  if (total && correct === total) {
    lines.push('', '🔥 Идеальная серия — так держать!');
  } else if (accuracy >= 80) {
    lines.push('', 'Отличный результат. Тема почти закреплена.');
  } else if (accuracy >= 50) {
    lines.push('', 'Неплохо! Ещё один подход — и станет увереннее.');
  } else {
    lines.push('', 'Тема пока сложная. Разберём её ещё раз?');
  }
  if (total >= 8 && accuracy >= 80) {
    const bonus = award(user.id, 'grammarCorrect', { xp: 20, actions: 0 });
    lines.push(...rewardLines(bonus).map((line) => `🎁 ${line}`));
  }
  const topicId = payload.topicId === 'mix' ? 'mix' : payload.topicId;
  return tg.editMessageText(chatId, messageId, lines.join('\n'), {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔁 Ещё раз', callback_data: `grammar:topic:${topicId}` },
          { text: '📈 Прогресс', callback_data: 'grammar:progress' },
        ],
        [{ text: '⬅️ В меню', callback_data: 'menu:main' }],
      ],
    },
  });
}

async function grammarProgress(chatId, messageId, userId) {
  const rows = db.grammarByTopic(userId);
  const stats = db.grammarStats(userId);
  const lines = [`<b>📈 Прогресс по темам</b>`, '', `Всего ответов: ${stats.total} · точность ${stats.accuracy}%`];
  if (!rows.length) {
    lines.push('', 'Пока нет данных — начни с любой темы.');
  } else {
    lines.push('');
    for (const row of rows.slice(0, 9)) {
      const topic = TOPIC_BY_ID.get(row.topic);
      const label = topic ? `${topic.emoji} ${topic.title}` : row.topic;
      lines.push(`${label}: ${row.correct}/${row.total} · ${row.accuracy}%`);
    }
  }
  const text = lines.join('\n');
  const options = { reply_markup: { inline_keyboard: [[{ text: '⬅️ К темам', callback_data: 'menu:grammar' }]] } };
  return messageId
    ? tg.editMessageText(chatId, messageId, text, options)
    : tg.sendMessage(chatId, text, options);
}

/* --------------------------------------------------------- слова: повтор */

async function startReview(user, chatId, messageId = null) {
  const words = db.dueWords(user.id, 1);
  const state = db.getState(user.id);
  const reviewed = state.mode === 'review' ? (state.payload.reviewed ?? 0) : 0;

  if (!words.length) {
    db.clearState(user.id);
    const text = [
      '🔁 <b>Повторение</b>',
      '',
      reviewed
        ? `Повторено слов: ${reviewed}. Новых к повторению пока нет — возвращайся завтра!`
        : 'Сейчас нет слов к повторению. Добавь новые слова — и они появятся здесь в нужный день.',
    ].join('\n');
    const options = { reply_markup: kb.wordsMenu(0) };
    return messageId ? tg.editMessageText(chatId, messageId, text, options) : tg.sendMessage(chatId, text, options);
  }

  const word = words[0];
  db.setState(user.id, 'review', { wordId: word.id, reviewed });
  const text = [
    '🔁 <b>Вспомни слово</b>',
    '',
    `<b>${escapeHtml(word.word)}</b>`,
    '',
    'Помнишь перевод? Нажми кнопку — и увидишь ответ.',
  ].join('\n');
  const options = { reply_markup: kb.reviewKeyboard() };
  return messageId ? tg.editMessageText(chatId, messageId, text, options) : tg.sendMessage(chatId, text, options);
}

async function reviewAnswer(user, chatId, messageId, known) {
  const state = db.getState(user.id);
  if (state.mode !== 'review') return { alert: 'Сессия повторения завершена.' };

  const updated = db.reviewWord(user.id, state.payload.wordId, known);
  if (!updated) {
    db.clearState(user.id);
    return tg.sendMessage(chatId, 'Слово не найдено — возможно, оно удалено.', { reply_markup: kb.wordsMenu(0) });
  }

  // Вспомнил — XP есть; забыл — только повторение без награды.
  const reward = award(user.id, 'wordReview', known ? {} : { xp: 0 });
  const reviewed = (state.payload.reviewed ?? 0) + 1;
  const lines = [
    `${known ? '✅' : '📚'} <b>${escapeHtml(updated.word)}</b> — ${escapeHtml(updated.translation || 'перевод не указан')}`,
    '',
    known ? `Следующий повтор: ${updated.due_date}` : 'Вернётся завтра — повторение закрепляет память. XP не начислен.',
    ...rewardLines(reward).filter((line) => !line.includes('Стрик')),
  ];
  await tg.editMessageText(chatId, messageId, lines.join('\n'), { reply_markup: { inline_keyboard: [] } });

  if (reviewed >= 10) {
    db.clearState(user.id);
    return tg.sendMessage(chatId, 'Отличная сессия — 10 слов достаточно на сегодня 💪', {
      reply_markup: kb.wordsMenu(db.countDueWords(user.id)),
    });
  }
  db.setState(user.id, 'review', { wordId: updated.id, reviewed });
  return startReview(user, chatId);
}

/* ------------------------------------------------- прочие экраны */

async function sendDashboard(user, chatId) {
  const fresh = db.getUser(user.id);
  const { text } = buildDashboard(user.id, fresh);
  return tg.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💡 Insight', callback_data: 'menu:insight' },
          { text: '🎯 Цели', callback_data: 'menu:goals' },
        ],
        [{ text: '⬅️ В меню', callback_data: 'menu:main' }],
      ],
    },
  });
}

async function sendInsight(user, chatId) {
  const insight = weeklyInsight(user.id);
  const topic = recommendedTopic(user.id);
  const lines = [insight.text];
  const topicInfo = topic ? TOPIC_BY_ID.get(topic.topic) : null;
  if (topicInfo) {
    lines.push('', `Рекомендую тренировку: ${topicInfo.emoji} <b>${topicInfo.title}</b>`);
  }
  const rows = [];
  if (topicInfo) rows.push([{ text: '🎯 Тренировать', callback_data: `grammar:topic:${topic.topic}` }]);
  rows.push([
    { text: '📊 Dashboard', callback_data: 'menu:dashboard' },
    { text: '⬅️ В меню', callback_data: 'menu:main' },
  ]);
  return tg.sendMessage(chatId, lines.join('\n'), { reply_markup: { inline_keyboard: rows } });
}

async function sendAchievements(user, chatId) {
  const list = achievementList(user.id);
  const lines = ['<b>🏆 Достижения</b>', ''];
  for (const item of list) {
    const mark = item.unlocked ? '✅' : '⬜';
    lines.push(`${mark} ${item.emoji} <b>${item.title}</b> — ${item.desc}`);
    lines.push(`   ${item.value}/${item.target} · ${item.percent}%`);
  }
  const unlockedCount = list.filter((item) => item.unlocked).length;
  lines.push('', `Открыто: <b>${unlockedCount}</b> из ${list.length}. Каждое даёт +50 XP.`);
  return tg.sendMessage(chatId, lines.join('\n'), { reply_markup: kb.achievementsKeyboard() });
}

async function sendGoals(user, chatId, messageId = null) {
  const text = `<b>🎯 Goals</b>\n\n${goalsText(user.id)}`;
  const used = new Set(db.listGoals(user.id).map((goal) => goal.metric));
  const available = GOAL_METRICS.filter((metric) => !used.has(metric.metric));
  const options = { reply_markup: kb.goalsKeyboard(available) };
  return messageId ? tg.editMessageText(chatId, messageId, text, options) : tg.sendMessage(chatId, text, options);
}

async function addGoal(user, chatId, messageId, metric) {
  const info = METRIC_TITLE.get(metric);
  if (!info) return { alert: 'Неизвестная цель.' };
  const existing = db.listGoals(user.id).find((goal) => goal.metric === metric);
  if (existing) return { alert: 'Такая цель уже есть.' };
  db.addGoal(user.id, { metric, title: info.title, target: DEFAULT_GOAL_TARGETS[metric] ?? 10 });
  return sendGoals(user, chatId, messageId);
}

async function sendSettings(user, chatId, messageId = null) {
  const fresh = db.getUser(user.id);
  const text = [
    '<b>⚙️ Настройки</b>',
    '',
    `🇬🇧 English only: <b>${fresh.english_only ? 'включён' : 'выключен'}</b>`,
    `📊 Уровень для подсказок: <b>${fresh.level_hint}</b>`,
    '',
    'English only — бот не переводит и не пишет по-русски в разговоре.',
    'Уровень влияет на сложность фраз AI-собеседника.',
  ].join('\n');
  const options = { reply_markup: kb.settingsMenu(fresh) };
  return messageId ? tg.editMessageText(chatId, messageId, text, options) : tg.sendMessage(chatId, text, options);
}

async function toggleEnglish(user, chatId, messageId = null) {
  const fresh = db.getUser(user.id);
  db.setEnglishOnly(user.id, !fresh.english_only);
  return sendSettings(user, chatId, messageId);
}

async function sendLevelMenu(user, chatId) {
  const fresh = db.getUser(user.id);
  return tg.sendMessage(chatId, '<b>📊 Уровень</b>\n\nВыбери свой уровень — AI-собеседник подстроит сложность фраз.', {
    reply_markup: kb.levelKeyboard(fresh.level_hint),
  });
}

async function setLevel(user, chatId, level) {
  const allowed = ['A1', 'A2', 'B1', 'B2', 'C1'];
  if (!allowed.includes(level)) {
    return tg.sendMessage(chatId, `Уровень должен быть один из: ${allowed.join(', ')}`);
  }
  db.setLevelHint(user.id, level);
  return tg.sendMessage(chatId, `Готово: уровень <b>${level}</b>.`, { reply_markup: kb.backToMenu() });
}

/* -------------------------------------------------------- списки данных */

async function lastDiary(user, chatId) {
  const entries = db.recentDiary(user.id, 5);
  if (!entries.length) {
    return tg.sendMessage(chatId, 'Пока нет записей. Напиши первую — это 2 минуты.', { reply_markup: kb.diaryKeyboard() });
  }
  const lines = ['<b>📜 Последние записи</b>', ''];
  for (const entry of entries) {
    lines.push(`<b>${entry.date}</b> · ${entry.word_count} слов · замечаний: ${entry.mistakes}`);
    lines.push(`<i>${escapeHtml(entry.text.slice(0, 300))}${entry.text.length > 300 ? '…' : ''}</i>`);
    lines.push('');
  }
  return tg.sendMessage(chatId, lines.join('\n'), { reply_markup: kb.diaryKeyboard() });
}

async function listWords(user, chatId) {
  const words = db.listWords(user.id, 20);
  if (!words.length) {
    return tg.sendMessage(chatId, 'Словарь пока пуст. Добавь первое слово.', { reply_markup: kb.wordsMenu(0) });
  }
  const due = db.countDueWords(user.id);
  const lines = ['<b>📚 Мои слова</b>', `Всего: ${db.countWords(user.id)} · к повторению: ${due}`, ''];
  words.forEach((word, index) => {
    const stats = word.correct || word.wrong ? ` · ✅${word.correct} ❌${word.wrong}` : '';
    const translation = word.translation ? ` — ${escapeHtml(word.translation)}` : '';
    lines.push(`${index + 1}. <b>${escapeHtml(word.word)}</b>${translation}${stats}`);
  });
  return tg.sendMessage(chatId, lines.join('\n'), { reply_markup: kb.wordsMenu(due) });
}

async function listWriting(user, chatId) {
  const items = db.listWriting(user.id, 5);
  if (!items.length) {
    return tg.sendMessage(chatId, 'Пока нет текстов. Возьми тему и напиши первый — даже 50 слов уже результат.', {
      reply_markup: kb.writingMenu(),
    });
  }
  const lines = ['<b>📄 Последние тексты</b>', ''];
  for (const item of items) {
    lines.push(`<b>${escapeHtml(item.topic)}</b> · ${item.word_count} слов · ${item.score}/100 · ${item.date}`);
  }
  return tg.sendMessage(chatId, lines.join('\n'), { reply_markup: kb.writingMenu() });
}

/* ------------------------------------------------------------ writing */

async function startWriting(user, chatId, messageId = null) {
  const topic = pickWritingTopic();
  const text = [
    '<b>✍️ Writing Practice</b>',
    '',
    `${topic.emoji} <b>${escapeHtml(topic.title)}</b>`,
    '',
    topic.prompt,
    '',
    'Напиши текст одним сообщением — я проверю и сохраню его.',
  ].join('\n');
  db.setState(user.id, 'writing', { topic: topic.title, prompt: topic.prompt });
  if (messageId) {
    return tg.editMessageText(chatId, messageId, text, { reply_markup: kb.writingPromptKeyboard() });
  }
  return tg.sendMessage(chatId, text, { reply_markup: kb.writingPromptKeyboard() });
}

async function saveWriting(user, chatId, text, payload = {}) {
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 10) {
    return tg.sendMessage(chatId, 'Слишком коротко. Попробуй написать хотя бы 20–40 слов — тогда разбор будет полезнее.');
  }
  const topic = payload.topic ?? 'Free writing';
  const review = await reviewUserText(text, { level: user.level_hint });
  const result = submitWriting(user.id, topic, text, { review });
  db.clearState(user.id);
  const hasErrors = hasIssues(review);
  const nonEnglish = isNonEnglish(review);
  // Ошибки есть или текст не на английском — текст сохраняется, но XP не начисляется.
  const reward = award(user.id, 'writing', rewardForReview(review));

  const parts = [
    `<b>✍️ ${escapeHtml(topic)}</b>`,
    '',
    result.feedback,
  ];
  if (result.corrected && result.corrected.toLowerCase() !== text.trim().toLowerCase()) {
    const label = nonEnglish ? '🇬🇧 Как это по-английски' : '🧽 Исправленный вариант';
    parts.push('', `<b>${label}</b>`, `<i>${escapeHtml(result.corrected)}</i>`);
  }
  if (result.previousAverage !== null) {
    const diff = result.score - result.previousAverage;
    parts.push('', diff >= 0
      ? `📈 Средний предыдущий балл: ${result.previousAverage} → сейчас ${result.score} (+${diff}).`
      : `📉 Средний предыдущий балл: ${result.previousAverage} → сейчас ${result.score} (${diff}). Так бывает, важно не останавливаться.`);
  }
  if (hasErrors) parts.push('', '⚠️ Есть замечания — XP за этот текст не начислен.');
  else if (nonEnglish) parts.push('', '🇷🇺 Текст не на английском — XP за него не начислен. Напиши тот же текст по-английски, и я проверю ошибки.');
  const rewards = rewardLines(reward);
  if (rewards.length) parts.push('', ...rewards);

  return tg.sendMessage(chatId, parts.join('\n'), { reply_markup: kb.writingMenu() });
}

/* ------------------------------------------------------------ callback */

export async function onCallback(query) {
  const from = query.from;
  if (!from || from.is_bot) return null;
  const user = db.ensureUser(from);
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const data = query.data ?? '';

  let result = null;
  try {
    result = await routeCallback(user, chatId, messageId, data);
  } catch (error) {
    console.error('[bot] callback failed:', data, error.message);
    result = { alert: 'Что-то пошло не так. Попробуй ещё раз.' };
  } finally {
    if (query.id) await tg.answerCallbackQuery(query.id, result?.alert ?? '', Boolean(result?.alert));
  }
  return result;
}

async function routeCallback(user, chatId, messageId, data) {
  if (!chatId) return { alert: 'Это действие доступно только в чате с ботом.' };

  if (data.startsWith('g:a:')) {
    const [, , index, choice] = data.split(':');
    return grammarAnswer(user, chatId, messageId, Number(index), Number(choice));
  }
  if (data.startsWith('grammar:topic:')) {
    return startGrammarSession(user, chatId, data.split(':')[2] ?? 'mix');
  }
  if (data.startsWith('goals:add:')) {
    return addGoal(user, chatId, messageId, data.split(':')[2]);
  }
  if (data.startsWith('settings:level:')) {
    db.setLevelHint(user.id, data.split(':')[2]);
    return sendSettings(user, chatId, messageId);
  }

  switch (data) {
    case 'menu:main':
      db.clearState(user.id);
      return tg.editMessageText(chatId, messageId, texts.menuText(db.getUser(user.id), userStatsSafe(user.id)), {
        reply_markup: kb.mainMenu(),
      });
    case 'menu:diary':
      db.setState(user.id, 'diary', {});
      return tg.editMessageText(chatId, messageId, texts.DIARY_TEXT, { reply_markup: kb.diaryKeyboard() });
    case 'menu:words':
      db.clearState(user.id);
      return tg.editMessageText(chatId, messageId, texts.WORDS_TEXT, {
        reply_markup: kb.wordsMenu(db.countDueWords(user.id)),
      });
    case 'menu:grammar':
      db.clearState(user.id);
      return tg.editMessageText(chatId, messageId, texts.GRAMMAR_TEXT, { reply_markup: kb.grammarMenu() });
    case 'menu:writing':
      db.clearState(user.id);
      return tg.editMessageText(chatId, messageId, texts.WRITING_TEXT, { reply_markup: kb.writingMenu() });
    case 'menu:chat':
      db.setState(user.id, 'chat', {});
      return tg.editMessageText(chatId, messageId, texts.chatReadyText(aiAvailable()), { reply_markup: kb.chatKeyboard() });
    case 'menu:dashboard':
      return sendDashboard(user, chatId);
    case 'menu:insight':
      return sendInsight(user, chatId);
    case 'menu:achievements':
      return sendAchievements(user, chatId);
    case 'menu:goals':
      return sendGoals(user, chatId);
    case 'menu:settings':
      return sendSettings(user, chatId, messageId);
    case 'menu:help':
      return tg.editMessageText(chatId, messageId, texts.HELP_TEXT, { reply_markup: kb.backToMenu() });
    default:
      break;
  }

  switch (data) {
    case 'diary:last':
      return lastDiary(user, chatId);
    case 'words:add':
      db.setState(user.id, 'word_add', {});
      return tg.editMessageText(
        chatId,
        messageId,
        [
          '<b>➕ Новое слово</b>',
          '',
          'Отправь слово и перевод одним сообщением:',
          '<code>exhausted - истощённый</code>',
          '',
          'Можно и без перевода — просто слово.',
        ].join('\n'),
        { reply_markup: kb.wordsMenu(db.countDueWords(user.id)) },
      );
    case 'words:review':
      return startReview(user, chatId);
    case 'words:list':
      return listWords(user, chatId);
    case 'review:known':
      return reviewAnswer(user, chatId, messageId, true);
    case 'review:unknown':
      return reviewAnswer(user, chatId, messageId, false);
    case 'grammar:progress':
      return grammarProgress(chatId, messageId, user.id);
    case 'g:next':
      return grammarNext(user, chatId, messageId);
    case 'g:stop':
    case 'g:finish':
      return grammarFinish(user, chatId, messageId);
    case 'writing:new':
      return startWriting(user, chatId, messageId);
    case 'writing:list':
      return listWriting(user, chatId);
    case 'settings:english':
      return toggleEnglish(user, chatId, messageId);
    case 'settings:level':
      return sendLevelMenu(user, chatId);
    case 'settings:clearchat':
      db.clearChatHistory(user.id);
      return { alert: 'История чата очищена.' };
    default:
      return { alert: 'Кнопка устарела. Открой /menu.' };
  }
}



import { TOPICS } from '../content/grammarBank.js';

const btn = (text, data) => ({ text, callback_data: data });

export const TOPIC_LABELS = {
  past_simple: '⏳ Past Simple',
  present_perfect: '✅ Present Perfect',
  articles: '🔤 Артикли',
  prepositions: '🧩 Предлоги',
  agreement: '🧷 Согласование',
  comparatives: '📐 Степени',
  gerund_infinitive: '🔁 Gerund',
  conditionals: '🌦 Conditionals',
  quantifiers: '⚖️ Quantifiers',
};

export const backToMenu = () => ({ inline_keyboard: [[btn('⬅️ В меню', 'menu:main')]] });

export const mainMenu = () => ({
  inline_keyboard: [
    [btn('📖 Дневник', 'menu:diary'), btn('📝 Слова', 'menu:words')],
    [btn('🎯 Грамматика', 'menu:grammar'), btn('✍️ Writing', 'menu:writing')],
    [btn('💬 AI Conversation', 'menu:chat'), btn('📊 Dashboard', 'menu:dashboard')],
    [btn('🏆 Достижения', 'menu:achievements'), btn('🎯 Цели', 'menu:goals')],
    [btn('💡 Insight за неделю', 'menu:insight'), btn('⚙️ Настройки', 'menu:settings')],
    [btn('❓ Помощь', 'menu:help')],
  ],
});

export const diaryKeyboard = () => ({
  inline_keyboard: [
    [btn('📜 Последние записи', 'diary:last')],
    [btn('⬅️ В меню', 'menu:main')],
  ],
});

export const wordsMenu = (dueCount = 0) => ({
  inline_keyboard: [
    [btn('➕ Добавить слово', 'words:add')],
    [btn(dueCount > 0 ? `🔁 Повторить (${dueCount})` : '🔁 Повторить', 'words:review')],
    [btn('📚 Мои слова', 'words:list')],
    [btn('⬅️ В меню', 'menu:main')],
  ],
});

export const reviewKeyboard = () => ({
  inline_keyboard: [
    [btn('✅ Знаю', 'review:known'), btn('❌ Забыл', 'review:unknown')],
    [btn('⬅️ Прервать', 'menu:words')],
  ],
});

export const grammarMenu = () => {
  const rows = [];
  for (let i = 0; i < TOPICS.length; i += 2) {
    rows.push(TOPICS.slice(i, i + 2).map((topic) => btn(TOPIC_LABELS[topic.id] ?? topic.title, `grammar:topic:${topic.id}`)));
  }
  rows.push([btn('🎲 Микс заданий', 'grammar:topic:mix')]);
  rows.push([btn('📈 Прогресс по темам', 'grammar:progress'), btn('⬅️ В меню', 'menu:main')]);
  return { inline_keyboard: rows };
};

export const exerciseKeyboard = (options, index) => ({
  inline_keyboard: [
    ...options.map((option, i) => [btn(`${String.fromCharCode(65 + i)} · ${option}`, `g:a:${index}:${i}`)]),
    [btn('🏁 Закончить', 'g:stop')],
  ],
});

export const afterAnswerKeyboard = (hasNext) => ({
  inline_keyboard: [
    [
      hasNext ? btn('➡️ Следующее', 'g:next') : btn('🏁 Результат', 'g:finish'),
      btn('🏁 Закончить', 'g:stop'),
    ],
  ],
});

export const writingMenu = () => ({
  inline_keyboard: [
    [btn('✍️ Новая тема', 'writing:new')],
    [btn('📄 Мои тексты', 'writing:list')],
    [btn('⬅️ В меню', 'menu:main')],
  ],
});

export const writingPromptKeyboard = () => ({
  inline_keyboard: [
    [btn('🔄 Другая тема', 'writing:new')],
    [btn('⬅️ Назад', 'menu:writing')],
  ],
});

export const chatKeyboard = () => ({
  inline_keyboard: [
    [btn('⏹ Завершить разговор', 'menu:main')],
  ],
});

export const settingsMenu = (user) => ({
  inline_keyboard: [
    [btn(user?.english_only ? '🇬🇧 English only: ВКЛ' : '🇬🇧 English only: ВЫКЛ', 'settings:english')],
    [btn(`📊 Уровень: ${user?.level_hint ?? 'A2'}`, 'settings:level')],
    [btn('🧹 Очистить историю чата', 'settings:clearchat')],
    [btn('⬅️ В меню', 'menu:main')],
  ],
});

export const levelKeyboard = (current) => ({
  inline_keyboard: [
    ['A1', 'A2', 'B1'].map((level) => btn(current === level ? `✅ ${level}` : level, `settings:level:${level}`)),
    ['B2', 'C1'].map((level) => btn(current === level ? `✅ ${level}` : level, `settings:level:${level}`)),
    [btn('⬅️ Назад', 'menu:settings')],
  ],
});

export const goalsKeyboard = (metrics) => ({
  inline_keyboard: [
    ...metrics.map((metric) => [btn(`➕ ${metric.label}`, `goals:add:${metric.metric}`)]),
    [btn('📊 Мой прогресс', 'menu:dashboard')],
    [btn('⬅️ В меню', 'menu:main')],
  ],
});

export const achievementsKeyboard = () => ({
  inline_keyboard: [
    [btn('📊 Dashboard', 'menu:dashboard'), btn('⬅️ В меню', 'menu:main')],
  ],
});

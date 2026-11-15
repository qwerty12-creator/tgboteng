/**
 * Подсказки "как звучит естественнее".
 * Не грамматические ошибки, а более живой английский.
 */
export const NATURAL_PHRASES = [
  { pattern: /\bI am very tired\b/gi, suggestion: "I'm exhausted", note: 'более естественно, чем "very tired"' },
  { pattern: /\bit was very interesting\b/gi, suggestion: 'it was fascinating', note: 'сильнее и живее' },
  { pattern: /\bvery good\b/gi, suggestion: 'great / amazing', note: '"very good" звучит нейтрально' },
  { pattern: /\bvery bad\b/gi, suggestion: 'terrible / awful', note: 'точнее передаёт эмоцию' },
  { pattern: /\bI like it very much\b/gi, suggestion: 'I really enjoy it', note: 'так говорят носители' },
  { pattern: /\bI think that\b/gi, suggestion: 'I think', note: '"that" обычно опускают' },
  { pattern: /\bin my opinion I think\b/gi, suggestion: 'in my opinion', note: 'не нужно дублировать' },
  { pattern: /\bI want to say\b/gi, suggestion: "I'd like to say", note: 'вежливее и естественнее' },
  { pattern: /\bIt was a good day\b/gi, suggestion: 'It was a lovely day', note: 'чуть более живой вариант' },
  { pattern: /\bI did a mistake\b/gi, suggestion: 'I made a mistake', note: 'устойчивое сочетание' },
  { pattern: /\bvery big\b/gi, suggestion: 'huge / enormous', note: 'один точный глагол/прилагательное лучше' },
  { pattern: /\bI am agree\b/gi, suggestion: 'I agree', note: 'agree — глагол' },
  { pattern: /\bI very like\b/gi, suggestion: 'I really like', note: 'порядок слов' },
  { pattern: /\bnowadays\b/gi, suggestion: 'these days', note: 'в разговорной речи звучит легче' },
  { pattern: /\bI go to work by foot\b/gi, suggestion: 'I walk to work', note: 'естественная формулировка' },
];

export function naturalSuggestions(text, limit = 2) {
  const found = [];
  for (const item of NATURAL_PHRASES) {
    const matches = [...text.matchAll(item.pattern)];
    if (!matches.length) continue;
    found.push({
      wrong: matches[0][0],
      suggestion: item.suggestion,
      note: item.note,
    });
    if (found.length >= limit) break;
  }
  return found;
}

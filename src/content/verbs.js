/**
 * Неправильные глаголы: база для упражнений, проверки ошибок и инсайтов.
 * base - инфинитив, past - Past Simple, pp - Past Participle, ru - перевод.
 */
export const IRREGULAR_VERBS = [
  { base: 'be', past: 'was', pp: 'been', ru: 'быть' },
  { base: 'become', past: 'became', pp: 'become', ru: 'становиться' },
  { base: 'begin', past: 'began', pp: 'begun', ru: 'начинать' },
  { base: 'break', past: 'broke', pp: 'broken', ru: 'ломать' },
  { base: 'bring', past: 'brought', pp: 'brought', ru: 'приносить' },
  { base: 'build', past: 'built', pp: 'built', ru: 'строить' },
  { base: 'buy', past: 'bought', pp: 'bought', ru: 'покупать' },
  { base: 'catch', past: 'caught', pp: 'caught', ru: 'ловить' },
  { base: 'choose', past: 'chose', pp: 'chosen', ru: 'выбирать' },
  { base: 'come', past: 'came', pp: 'come', ru: 'приходить' },
  { base: 'cost', past: 'cost', pp: 'cost', ru: 'стоить' },
  { base: 'cut', past: 'cut', pp: 'cut', ru: 'резать' },
  { base: 'do', past: 'did', pp: 'done', ru: 'делать' },
  { base: 'draw', past: 'drew', pp: 'drawn', ru: 'рисовать' },
  { base: 'drink', past: 'drank', pp: 'drunk', ru: 'пить' },
  { base: 'drive', past: 'drove', pp: 'driven', ru: 'водить машину' },
  { base: 'eat', past: 'ate', pp: 'eaten', ru: 'есть' },
  { base: 'fall', past: 'fell', pp: 'fallen', ru: 'падать' },
  { base: 'feel', past: 'felt', pp: 'felt', ru: 'чувствовать' },
  { base: 'find', past: 'found', pp: 'found', ru: 'находить' },
  { base: 'fly', past: 'flew', pp: 'flown', ru: 'летать' },
  { base: 'forget', past: 'forgot', pp: 'forgotten', ru: 'забывать' },
  { base: 'get', past: 'got', pp: 'gotten', ru: 'получать' },
  { base: 'give', past: 'gave', pp: 'given', ru: 'давать' },
  { base: 'go', past: 'went', pp: 'gone', ru: 'идти' },
  { base: 'grow', past: 'grew', pp: 'grown', ru: 'расти' },
  { base: 'have', past: 'had', pp: 'had', ru: 'иметь' },
  { base: 'hear', past: 'heard', pp: 'heard', ru: 'слышать' },
  { base: 'keep', past: 'kept', pp: 'kept', ru: 'держать' },
  { base: 'know', past: 'knew', pp: 'known', ru: 'знать' },
  { base: 'leave', past: 'left', pp: 'left', ru: 'уходить' },
  { base: 'lose', past: 'lost', pp: 'lost', ru: 'терять' },
  { base: 'make', past: 'made', pp: 'made', ru: 'делать' },
  { base: 'meet', past: 'met', pp: 'met', ru: 'встречать' },
  { base: 'pay', past: 'paid', pp: 'paid', ru: 'платить' },
  { base: 'read', past: 'read', pp: 'read', ru: 'читать' },
  { base: 'ride', past: 'rode', pp: 'ridden', ru: 'ездить верхом' },
  { base: 'run', past: 'ran', pp: 'run', ru: 'бегать' },
  { base: 'say', past: 'said', pp: 'said', ru: 'говорить' },
  { base: 'see', past: 'saw', pp: 'seen', ru: 'видеть' },
  { base: 'sell', past: 'sold', pp: 'sold', ru: 'продавать' },
  { base: 'send', past: 'sent', pp: 'sent', ru: 'отправлять' },
  { base: 'sing', past: 'sang', pp: 'sung', ru: 'петь' },
  { base: 'sit', past: 'sat', pp: 'sat', ru: 'сидеть' },
  { base: 'sleep', past: 'slept', pp: 'slept', ru: 'спать' },
  { base: 'speak', past: 'spoke', pp: 'spoken', ru: 'говорить' },
  { base: 'spend', past: 'spent', pp: 'spent', ru: 'тратить' },
  { base: 'stand', past: 'stood', pp: 'stood', ru: 'стоять' },
  { base: 'swim', past: 'swam', pp: 'swum', ru: 'плавать' },
  { base: 'take', past: 'took', pp: 'taken', ru: 'брать' },
  { base: 'teach', past: 'taught', pp: 'taught', ru: 'учить' },
  { base: 'tell', past: 'told', pp: 'told', ru: 'рассказывать' },
  { base: 'think', past: 'thought', pp: 'thought', ru: 'думать' },
  { base: 'throw', past: 'threw', pp: 'thrown', ru: 'бросать' },
  { base: 'understand', past: 'understood', pp: 'understood', ru: 'понимать' },
  { base: 'wake up', past: 'woke up', pp: 'woken up', ru: 'просыпаться' },
  { base: 'wear', past: 'wore', pp: 'worn', ru: 'носить' },
  { base: 'win', past: 'won', pp: 'won', ru: 'побеждать' },
  { base: 'write', past: 'wrote', pp: 'written', ru: 'писать' },
];

const byPast = new Map();
const byBase = new Map();
for (const verb of IRREGULAR_VERBS) {
  byPast.set(verb.past, verb);
  byBase.set(verb.base, verb);
}

export function verbByPast(word) {
  return byPast.get(String(word).toLowerCase());
}

export function verbByBase(word) {
  return byBase.get(String(word).toLowerCase());
}

export function pastToBase(word) {
  const verb = byPast.get(String(word).toLowerCase());
  return verb ? verb.base : null;
}

export function pastToParticiple(word) {
  const verb = byPast.get(String(word).toLowerCase());
  return verb ? verb.pp : null;
}

/** Случайная выборка нужного размера. */
export function sample(list, size) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, size);
}

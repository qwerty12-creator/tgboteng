import { IRREGULAR_VERBS, verbByBase, verbByPast } from '../content/verbs.js';

const PAST_TO_BASE = new Map(IRREGULAR_VERBS.map((v) => [v.past, v.base]));

const BE_FORMS = { i: 'was', he: 'was', she: 'was', it: 'was', we: 'were', you: 'were', they: 'were' };
const BE_PRESENT = { i: 'am', he: 'is', she: 'is', it: 'is', we: 'are', you: 'are', they: 'are' };

const UNCOUNTABLE = {
  informations: 'information',
  advices: 'advice',
  peoples: 'people',
  furnitures: 'furniture',
  equipments: 'equipment',
  luggages: 'luggage',
  homeworks: 'homework',
  moneys: 'money',
  knowledges: 'knowledge',
};

const A_EXCEPTIONS = /^(university|universities|user|users|useful|uniform|unique|union|unit|european|one|once|usual)/i;
const THIRD_PERSON_VERBS = 'go|come|like|want|need|think|know|work|live|study|play|eat|drink|read|write|speak|watch|make|take|look|feel|love|help|try|start|finish|say|see|do|have|get|give|find|tell';

function thirdPerson(verb) {
  const lower = verb.toLowerCase();
  if (lower === 'have') return 'has';
  if (lower === 'do') return 'does';
  if (lower === 'go') return 'goes';
  if (/(s|x|z|ch|sh|o)$/.test(lower)) return `${lower}es`;
  if (/[^aeiou]y$/.test(lower)) return `${lower.slice(0, -1)}ies`;
  return `${lower}s`;
}

function keepCase(source, replacement) {
  if (source[0] && source[0] === source[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

const rule = (tag, title, reason, regex, replace) => ({ tag, title, reason, regex, replace });

const thirdPersonRegex = new RegExp(
  '\\b(?:(do|does|did|can|could|will|would|should|may|might|must|to)\\s+)?(he|she|it)\\s+(' + THIRD_PERSON_VERBS + ')\\b',
  'gi',
);

export const RULES = [
  // --- Past Simple ---
  rule(
    'past_after_aux',
    'Past Simple: после did / didn\'t нужна начальная форма',
    'После вспомогательного did смысловой глагол стоит в инфинитиве: did you go, I didn\'t go.',
    /\b(did|didn't|does|doesn't|do|don't)\s+([a-z]+)\b/gi,
    (match, aux, word) => {
      const base = PAST_TO_BASE.get(word.toLowerCase());
      if (!base) return null;
      return `${aux} ${base}`;
    },
  ),
  rule(
    'present_perfect_pp',
    'Present Perfect: нужна третья форма (Past Participle)',
    'После have / has / had используется Past Participle: have gone, has seen.',
    /\b(have|has|had|haven't|hasn't|hadn't)\s+([a-z]+)\b/gi,
    (match, aux, word) => {
      const verb = verbByPast(word);
      if (!verb || verb.pp === word.toLowerCase()) return null;
      return `${aux} ${verb.pp}`;
    },
  ),
  rule(
    'past_marker_be',
    'С маркером прошедшего времени нужен was / were',
    'yesterday / last week требуют Past Simple: I was, they were.',
    /\b(yesterday|last night|last week|last month|last year)\b([^.!?\n]{0,25})\b(I|he|she|it|we|they|you)\s+(am|is|are)\b/gi,
    (match, marker, between, subject, be) => {
      const fixed = BE_FORMS[subject.toLowerCase()];
      if (!fixed) return null;
      return `${marker}${between}${subject} ${fixed}`;
    },
  ),
  rule(
    'past_marker_verb',
    'С маркером прошедшего времени нужен Past Simple',
    'yesterday / last week описывают прошлое, поэтому глагол идёт в Past Simple.',
    /\b(yesterday|last night|last week|last month|last year)\b([^.!?\n]{0,25})\b(I|he|she|it|we|they|you)\s+([a-z]+)\b/gi,
    (match, marker, between, subject, verb) => {
      const info = verbByBase(verb);
      if (!info || info.past === info.base) return null;
      const past = keepCase(verb, info.past);
      return `${marker}${between}${subject} ${past}`;
    },
  ),
  // --- Согласование ---
  rule(
    'subject_verb_agreement',
    'Согласование подлежащего и глагола',
    'he / she / it -> does, has; I / we / they / you -> do, have.',
    /\b(he|she|it)\s+(don't|do not|do)\b/gi,
    (match, subject, aux) => {
      if (/do not/i.test(aux)) return `${subject} does not`;
      return `${subject} doesn't`;
    },
  ),
  rule(
    'subject_have',
    'Согласование: he / she / it + has',
    'В 3-м лице единственного числа have превращается в has.',
    /\b(he|she|it)\s+have\b/gi,
    (match, subject) => `${subject} has`,
  ),
  rule(
    'plural_do',
    'Согласование: I / we / they / you + don\'t',
    'does используется только с he / she / it.',
    /\b(they|we|you|I)\s+(doesn't|does)\b/gi,
    (match, subject, aux) => `${subject} ${aux.toLowerCase().startsWith("doesn't") ? "don't" : 'do'}`,
  ),
  rule(
    'third_person_s',
    '3-е лицо единственного числа: нужен -s',
    'he works, she likes, it goes.',
    thirdPersonRegex,
    (match, aux, subject, verb) => {
      if (aux) return null;
      return `${subject} ${thirdPerson(verb)}`;
    },
  ),
  rule(
    'missing_be',
    'Пропущен глагол to be',
    'В английском нужна связка: I am tired, she is happy.',
    /\b(I|he|she|we|they|you)\s+(very|so|really|too|quite|always|often)\s+(tired|happy|sad|busy|hungry|angry|excited|nervous|bored|sleepy|glad|ready|sure|lucky|late)\b/gi,
    (match, subject, adverb, adjective) => `${subject} ${BE_PRESENT[subject.toLowerCase()]} ${adverb} ${adjective}`,
  ),
  rule(
    'be_agree',
    'agree — это глагол, to be не нужен',
    'Правильно: I agree, I totally agree.',
    /\b(I|we|they|you)\s+(am|is|are)\s+agree\b/gi,
    (match, subject) => `${subject} agree`,
  ),
  rule(
    'missing_article',
    'Пропущен артикль a / an',
    'I am a student, he is a doctor.',
    /\b(am|is|are)\s+(student|teacher|doctor|engineer|driver|nurse|manager|designer|programmer|writer|artist|musician|student)\b/gi,
    (match, be, noun) => {
      const article = /^[aeiou]/i.test(noun) ? 'an' : 'a';
      return `${be} ${article} ${noun}`;
    },
  ),
  // --- Артикли, исчисляемость, степени сравнения ---
  rule(
    'a_an',
    'Нужен артикль an перед гласным звуком',
    'an apple, an idea.',
    /\ba\s+([a-z]+)\b/gi,
    (match, word) => {
      if (!/^[aeiou]/i.test(word) || A_EXCEPTIONS.test(word)) return null;
      return `an ${word}`;
    },
  ),
  rule(
    'uncountable_nouns',
    'Неисчисляемое существительное без -s',
    'advice, information, homework, money — без множественного числа.',
    /\b(informations|advices|peoples|furnitures|equipments|luggages|homeworks|moneys|knowledges)\b/gi,
    (match) => UNCOUNTABLE[match.toLowerCase()] ?? null,
  ),
  rule(
    'double_comparative',
    'Двойная степень сравнения',
    'better, easier, best — без more / most.',
    /\b(more|most)\s+(better|worse|easier|bigger|smaller|harder|faster|slower|happier)\b/gi,
    (match, prefix, adjective) => adjective,
  ),
  rule(
    'quantifiers',
    'much / many: исчисляемое и неисчисляемое',
    'many people, much time.',
    /\b(too|so)\s+much\s+(people|things|books|friends|students|words|questions|mistakes|lessons)\b/gi,
    (match, adverb, noun) => `${adverb} many ${noun}`,
  ),
  rule(
    'many_uncountable',
    'much для неисчисляемых существительных',
    'much time, much money, much work.',
    /\bmany\s+(money|time|water|information|homework|advice|work|news|traffic)\b/gi,
    (match, noun) => `much ${noun}`,
  ),
  // --- Предлоги и устойчивые сочетания ---
  rule(
    'depend_of',
    'depend on, а не depend of',
    'Устойчивое сочетание: depend on / it depends on.',
    /\bdepend(s|ed|ing)?\s+of\b/gi,
    (match, suffix = '') => `depend${suffix} on`,
  ),
  rule(
    'listen_music',
    'listen to music',
    'listen требует предлог to: listen to me, listen to music.',
    /\blisten(ing|ed)?\s+(music|me|him|her|them|us|the radio|podcasts?)\b/gi,
    (match, suffix = '', object) => `listen${suffix} to ${object}`,
  ),
  rule(
    'married_with',
    'married to',
    'Правильно: she is married to him.',
    /\bmarried\s+with\b/gi,
    () => 'married to',
  ),
  rule(
    'explain_me',
    'explain to me',
    'explain / describe требуют предлог to перед адресатом.',
    /\b(explain|describe)\s+(me|him|her|us|them)\b/gi,
    (match, verb, pronoun) => `${verb} to ${pronoun}`,
  ),
  rule(
    'weekday_preposition',
    'Дни недели с предлогом on',
    'on Monday, on Friday.',
    /\bin\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
    (match, day) => `on ${day}`,
  ),
  rule(
    'picture_preposition',
    'in the picture / photo',
    'На фото — in the picture, а не on.',
    /\bon\s+(the\s+)?(picture|photo)\b/gi,
    (match, article = '', noun) => `in ${article}${noun}`,
  ),
  rule(
    'since_for',
    'since / for: длительность через for',
    'for three years, since 2020.',
    /\bsince\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|a few|many|several)\s+(years?|months?|weeks?|days?|hours?)\b/gi,
    (match, amount, unit) => `for ${amount} ${unit}`,
  ),
  rule(
    'do_make_mistake',
    'make a mistake',
    'Ошибку делают через make: made a mistake.',
    /\b(do|did|does|doing)\s+a\s+mistake\b/gi,
    (match, verb) => {
      const forms = { do: 'make', did: 'made', does: 'makes', doing: 'making' };
      return `${forms[verb.toLowerCase()] ?? verb} a mistake`;
    },
  ),
  rule(
    'make_photo',
    'take a photo',
    'Фотографируют через take, а не make.',
    /\bmake\s+(a\s+)?(photo|picture)\b/gi,
    (match, article = '', noun) => `take ${article}${noun}`,
  ),
  rule(
    'make_homework',
    'do homework',
    'Домашнюю работу делают через do.',
    /\bmake\s+homework\b/gi,
    () => 'do homework',
  ),
  rule(
    'everyday_adverb',
    'every day пишется раздельно',
    'everyday — прилагательное (everyday life), every day — наречие.',
    /\beveryday\b(?=\s*(?:[,!?]|\.|$))/gi,
    () => 'every day',
  ),
  rule(
    'age_expression',
    'Возраст: to be ... years old',
    'I am 20 years old (не have).',
    /\bI\s+(have|am)\s+(\d{1,2})\s+years?\b/gi,
    (match, verb, num) => `I am ${num} years old`,
  ),
  rule(
    'double_negative',
    'Двойное отрицание',
    'После didn\'t / don\'t используем anything, anyone, anywhere.',
    /\b(didn't|don't|doesn't|can't|couldn't|won't|wasn't|weren't|isn't|aren't)\b([^.!?\n]{0,30}?)\b(nothing|nobody|nowhere|no one)\b/gi,
    (match, aux, between, word) => {
      const map = { nothing: 'anything', nobody: 'anybody', nowhere: 'anywhere', 'no one': 'anyone' };
      return `${aux}${between}${map[word.toLowerCase()] ?? word}`;
    },
  ),
  rule(
    'ed_ing_adjectives',
    '-ed для чувств, -ing для причины',
    'I am bored (скучно мне), the film is boring (скучный фильм).',
    /\bI('m| am)\s+boring\b/gi,
    (match, be) => `I${be.trim() === "'m" ? "'m" : ' am'} bored`,
  ),
];

/** Проверка текста: возвращает исправленный вариант и найденные ошибки. */
export function checkText(text) {
  let corrected = String(text ?? '').replace(/\s+/g, ' ').trim();
  const issues = [];
  for (const current of RULES) {
    let hits = 0;
    let firstWrong = '';
    let firstRight = '';
    corrected = corrected.replace(current.regex, (...args) => {
      const replacement = current.replace(...args);
      if (replacement == null || replacement === args[0]) return args[0];
      hits += 1;
      if (!firstWrong) {
        firstWrong = args[0];
        firstRight = replacement;
      }
      return replacement;
    });
    if (hits > 0) {
      issues.push({
        tag: current.tag,
        title: current.title,
        reason: current.reason,
        wrong: firstWrong,
        right: firstRight,
        hits,
      });
    }
  }
  // Регистр букв (начало предложения, местоимение i) сознательно не проверяем:
  // пользователь пишет с телефона и часто не ставит заглавные — это не ошибка.
  return { corrected, issues, count: issues.length };
}

/** Сколько типов ошибок и сколько всего вхождений. */
export function issueSummary(issues) {
  const total = issues.reduce((sum, issue) => sum + (issue.hits ?? 1), 0);
  return { types: issues.length, total };
}

/** Короткие подсказки для ненавязчивого вывода. */
export function shortTips(issues, limit = 3) {
  return issues.slice(0, limit).map((issue) => ({
    tag: issue.tag,
    title: issue.title,
    text: issue.wrong && issue.right ? `${issue.wrong} → ${issue.right}` : issue.title,
  }));
}

/** Запоминает ошибки пользователя в агрегированном виде. */
export function rememberIssues(userId, issues, recordMistake) {
  for (const issue of issues) {
    recordMistake(userId, {
      tag: issue.tag,
      title: issue.title,
      wrong: issue.wrong,
      right: issue.right,
    });
  }
}


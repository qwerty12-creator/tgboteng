/**
 * Офлайн-собеседник: работает без API-ключа.
 * Поддерживает диалог, задаёт вопросы и подстраивается под уровень.
 */
const TOPICS = [
  {
    keys: ['tired', 'exhausted', 'sleep', 'sleepy', 'busy day', 'long day'],
    replies: [
      'That sounds exhausting — long days like that really drain your energy.',
      'I can imagine how tired you must feel after a day like that.',
      'Being that tired is never fun, but it means you did a lot today.',
    ],
    questions: [
      'What made today so tiring?',
      'Which part of the day was the hardest?',
      'What do you usually do to relax after a day like this?',
    ],
  },
  {
    keys: ['work', 'job', 'office', 'meeting', 'boss', 'colleague', 'project'],
    replies: [
      'Work can be a lot sometimes, especially when the week is busy.',
      'That sounds like a productive day at work.',
      'It is great that you notice how your work affects your mood.',
    ],
    questions: [
      'What was the most interesting task today?',
      'Do you prefer working alone or with your team?',
      'What would make your workday better?',
    ],
  },
  {
    keys: ['school', 'university', 'lesson', 'class', 'teacher', 'exam', 'study', 'homework', 'test'],
    replies: [
      'Studying takes real effort, and it is good that you keep going.',
      'That sounds like an intense day of learning.',
      'Exams and lessons can be stressful, but you are making progress.',
    ],
    questions: [
      'Which subject feels the most difficult right now?',
      'What did you learn today that you found interesting?',
      'How do you usually prepare for a test?',
    ],
  },
  {
    keys: ['food', 'cook', 'cooking', 'dinner', 'lunch', 'breakfast', 'coffee', 'restaurant', 'cafe'],
    replies: [
      'That sounds delicious — food is such a big part of a good day.',
      'I love hearing about meals; they say a lot about a person.',
      'Cooking can be relaxing when you have enough time.',
    ],
    questions: [
      'What was the best thing you ate today?',
      'Do you prefer cooking at home or going to a cafe?',
      'What is your favourite dish these days?',
    ],
  },
  {
    keys: ['weekend', 'saturday', 'sunday', 'holiday', 'vacation', 'rest'],
    replies: [
      'Weekends are precious — I hope you had some time for yourself.',
      'That sounds like a nice way to spend your free time.',
      'A good weekend can change the whole next week.',
    ],
    questions: [
      'What did you enjoy the most this weekend?',
      'Do you have any plans for the next one?',
      'Do you prefer quiet weekends or busy ones?',
    ],
  },
  {
    keys: ['travel', 'trip', 'flight', 'train', 'city', 'country', 'abroad', 'hotel'],
    replies: [
      'Travelling sounds exciting — new places always give fresh energy.',
      'I love the feeling of discovering a new city.',
      'That sounds like a memorable journey.',
    ],
    questions: [
      'Where would you like to go next?',
      'What do you usually notice first in a new city?',
      'Do you prefer travelling alone or with someone?',
    ],
  },
  {
    keys: ['movie', 'film', 'series', 'show', 'cinema', 'watch', 'watched'],
    replies: [
      'Films are a great way to relax and to practise English.',
      'That sounds like a good choice for the evening.',
      'I like how a good story stays with you afterwards.',
    ],
    questions: [
      'What did you like about it?',
      'Would you recommend it to a friend?',
      'Do you prefer films or series?',
    ],
  },
  {
    keys: ['music', 'song', 'band', 'concert', 'playlist'],
    replies: [
      'Music can change your mood in a second.',
      'That sounds like a great soundtrack to your day.',
      'I like that music is such a personal thing.',
    ],
    questions: [
      'What have you been listening to lately?',
      'Does the music you like depend on your mood?',
      'Do you prefer live concerts or headphones at home?',
    ],
  },
  {
    keys: ['sport', 'gym', 'run', 'running', 'walk', 'walking', 'fitness', 'football', 'yoga', 'swim'],
    replies: [
      'Staying active is a great habit, even when it is hard to start.',
      'Movement is such a good way to clear your head.',
      'That sounds like a healthy part of your routine.',
    ],
    questions: [
      'How often do you train?',
      'What sport would you like to try next?',
      'Do you prefer morning or evening workouts?',
    ],
  },
  {
    keys: ['friend', 'friends', 'family', 'mother', 'father', 'sister', 'brother', 'partner', 'together'],
    replies: [
      'People around us really shape our days.',
      'It sounds like you had warm time with people you care about.',
      'Time with the important people in your life matters a lot.',
    ],
    questions: [
      'What did you talk about?',
      'Who do you usually spend your free time with?',
      'What do you like doing together?',
    ],
  },
  {
    keys: ['happy', 'glad', 'great day', 'good day', 'proud', 'excited', 'achieved', 'finally'],
    replies: [
      'That is wonderful to hear!',
      'What a lovely thing to share — you should feel proud.',
      'Good moments like this are worth remembering.',
    ],
    questions: [
      'What made it so special?',
      'How are you going to celebrate it?',
      'What is your plan for tomorrow?',
    ],
  },
  {
    keys: ['sad', 'angry', 'upset', 'worried', 'stressed', 'anxious', 'difficult', 'hard'],
    replies: [
      'That sounds hard, and it is okay to feel that way.',
      'I am sorry to hear that. Thank you for sharing it.',
      'Difficult days happen, and it helps to put them into words.',
    ],
    questions: [
      'Do you want to talk about what happened?',
      'What usually helps you feel a little better?',
      'Is there someone you can talk to about it?',
    ],
  },
  {
    keys: ['think', 'opinion', 'believe', 'maybe', 'probably', 'future', 'plan', 'going to'],
    replies: [
      'That is an interesting point of view.',
      'Thanks for sharing your opinion — it makes sense.',
      'I like the way you think about it.',
    ],
    questions: [
      'What made you start thinking about it?',
      'How would you explain it to someone else?',
      'Has your opinion changed over time?',
    ],
  },
];

const GENERIC_REPLIES = [
  'That is interesting — thank you for sharing.',
  'I see what you mean.',
  'That sounds like an important moment of your day.',
  'Good to know! Tell me a little more.',
  'That is a nice detail to share.',
];

const GENERIC_QUESTIONS = [
  'What happened next?',
  'How did you feel about it?',
  'Why was that important to you?',
  'Can you describe it a little more?',
  'What are you planning to do next?',
];

const SIMPLE_QUESTIONS = ['What happened next?', 'How did you feel?', 'Why?', 'What do you do next?'];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/** Локальный ответ на сообщение пользователя. */
export function localChatReply(text, { level = 'A2' } = {}) {
  const lower = String(text ?? '').toLowerCase();
  const topic = TOPICS.find((entry) => entry.keys.some((key) => lower.includes(key)));
  const beginner = ['a1', 'a2', 'beginner'].includes(String(level).toLowerCase());
  const reply = topic ? pick(topic.replies) : pick(GENERIC_REPLIES);
  const question = topic && !beginner ? pick(topic.questions) : pick(SIMPLE_QUESTIONS);
  return `${reply} ${question}`;
}

export { TOPICS as LOCAL_CHAT_TOPICS };


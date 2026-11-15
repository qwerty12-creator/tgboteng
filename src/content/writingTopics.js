/** Темы для письменной практики. */
export const WRITING_TOPICS = [
  { emoji: '☀️', title: 'My perfect weekend', prompt: 'Describe your perfect weekend. What would you do, where would you go and who would you spend it with? (60–100 words)' },
  { emoji: '🎓', title: 'A lesson I will never forget', prompt: 'Tell a story about a lesson, a course or a teacher that changed the way you think. Use Past Simple and Past Continuous. (60–120 words)' },
  { emoji: '✈️', title: 'A place I want to visit', prompt: 'Choose a country or city you dream about. Explain why and what you would do there. (60–100 words)' },
  { emoji: '💼', title: 'My dream job', prompt: 'Describe your dream job. What skills do you need and what would your typical day look like? (60–120 words)' },
  { emoji: '📱', title: 'Technology in my life', prompt: 'How does technology help you every day? Add one thing you would change. Use linking words. (80–120 words)' },
  { emoji: '🍳', title: 'Food that reminds me of home', prompt: 'Write about a dish that feels like home. When do you eat it and who cooks it? (60–100 words)' },
  { emoji: '🎧', title: 'A song that describes my mood', prompt: 'Pick a song and explain what it means to you. What memories does it bring back? (60–100 words)' },
  { emoji: '🧠', title: 'A habit I want to build', prompt: 'Describe a habit you want to build and a plan to start. Use Present Perfect and future forms. (60–120 words)' },
  { emoji: '🌍', title: 'Learning English: my story', prompt: 'Why did you start learning English? What is the easiest and the hardest part for you? (80–120 words)' },
  { emoji: '🎬', title: 'A film review', prompt: 'Write a short review of a film you watched recently. Recommend or warn the reader. (60–100 words)' },
];

export function pickWritingTopic() {
  return WRITING_TOPICS[Math.floor(Math.random() * WRITING_TOPICS.length)];
}

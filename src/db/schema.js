export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id               INTEGER PRIMARY KEY,
  username         TEXT,
  first_name       TEXT,
  xp               INTEGER NOT NULL DEFAULT 0,
  streak_current   INTEGER NOT NULL DEFAULT 0,
  streak_best      INTEGER NOT NULL DEFAULT 0,
  last_active_date TEXT,
  english_only     INTEGER NOT NULL DEFAULT 1,
  level_hint       TEXT NOT NULL DEFAULT 'A2',
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS states (
  user_id    INTEGER PRIMARY KEY,
  mode       TEXT NOT NULL DEFAULT '',
  payload    TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS diary (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  text       TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  mistakes   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  date       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_diary_user_date ON diary(user_id, date);

CREATE TABLE IF NOT EXISTS words (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  word        TEXT NOT NULL,
  translation TEXT NOT NULL DEFAULT '',
  example     TEXT NOT NULL DEFAULT '',
  box         INTEGER NOT NULL DEFAULT 0,
  due_date    TEXT NOT NULL,
  correct     INTEGER NOT NULL DEFAULT 0,
  wrong       INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  date        TEXT NOT NULL,
  UNIQUE(user_id, word)
);
CREATE INDEX IF NOT EXISTS idx_words_user_due ON words(user_id, due_date);

CREATE TABLE IF NOT EXISTS grammar_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  topic      TEXT NOT NULL,
  prompt     TEXT NOT NULL,
  given      TEXT NOT NULL DEFAULT '',
  answer     TEXT NOT NULL DEFAULT '',
  is_correct INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  date       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_grammar_user_date ON grammar_attempts(user_id, date);

CREATE TABLE IF NOT EXISTS writing (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  topic      TEXT NOT NULL DEFAULT '',
  text       TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  score      INTEGER NOT NULL DEFAULT 0,
  feedback   TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  date       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_writing_user_date ON writing(user_id, date);

CREATE TABLE IF NOT EXISTS mistakes (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tag     TEXT NOT NULL,
  title   TEXT NOT NULL,
  wrong   TEXT NOT NULL DEFAULT '',
  right   TEXT NOT NULL DEFAULT '',
  hints   TEXT NOT NULL DEFAULT '[]',
  count   INTEGER NOT NULL DEFAULT 0,
  last_at TEXT NOT NULL,
  UNIQUE(user_id, tag)
);

CREATE TABLE IF NOT EXISTS mistake_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  tag        TEXT NOT NULL,
  date       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mistake_events_user_date ON mistake_events(user_id, date);


CREATE TABLE IF NOT EXISTS goals (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  metric     TEXT NOT NULL,
  title      TEXT NOT NULL,
  target     INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  archived   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id, archived);

CREATE TABLE IF NOT EXISTS achievements (
  user_id     INTEGER NOT NULL,
  code        TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,
  PRIMARY KEY(user_id, code)
);

CREATE TABLE IF NOT EXISTS activity (
  user_id INTEGER NOT NULL,
  date    TEXT NOT NULL,
  actions INTEGER NOT NULL DEFAULT 0,
  xp      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, date)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  role       TEXT NOT NULL,
  text       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages(user_id, id);
`;

# YOUR ENGLISH JOURNEY (LINGO)

Telegram-бот — личный дневник английского: записи с разбором ошибок, словарь с интервальным повторением, грамматика, письменная практика, AI-разговор, статистика, XP, уровни и достижения.

Ноль npm-зависимостей: только Node.js (>= 22.5), встроенный `node:sqlite` и `fetch`.

## Быстрый старт

```powershell
# 1. Токен от @BotFather
Copy-Item .env.example .env
# вставь BOT_TOKEN=123456:ABC...

# 2. Запуск
npm start
```

Ключ AI не обязателен: без него в режиме «AI Conversation» работает встроенный офлайн-собеседник.

```powershell
npm run dev     # запуск с автоперезагрузкой
npm test        # 68 тестов на node:test
```

## Что внутри

| Раздел | Что делает |
| --- | --- |
| 📖 Daily Diary | Пишешь 2–5 предложений — бот проверяет грамматику, сохраняет запись, начисляет XP |
| 📝 Word Bank | Слова `word - перевод`, повторение по интервалам (день → 1 → 2 → 4 → 7 → 14 → 30) |
| 🎯 Grammar Practice | 45+ упражнений в 9 темах + автогенерация форм неправильных глаголов |
| ✍️ Writing Practice | Тема → текст 60–120 слов → оценка 0–100, разбор и исправленный вариант |
| 💬 AI Conversation | Диалог на английском; ошибки исправляются ненавязчиво, внизу — подсказки |
| 📊 Dashboard | Таблица результатов, ASCII-график за 30 дней, новые слова, частые ошибки, динамика, цели |
| 💡 Weekly Insight | Что повторяется в ошибках, что тренировать, стало ли лучше |
| 🏆 Достижения | First Entry, Word Collector, 7-Day Streak, Grammar Master, Writing Lover, Consistency |
| 🎧 Голосовые | Речь → текст: DeepSeek ASR в облаке (ogg/opus телеграм-голосовых принимается как есть) или локальный whisper.cpp + ffmpeg |

Уровни: Beginner → Explorer (300 XP) → Intermediate (900) → Advanced (2000) → Fluent (4000).
XP: дневник 25, слово 10, повторение слова 6, верное упражнение 12, текст 40, сообщение в чате 5, достижение 50, первый шаг дня +15.

**Правило ошибок:** если проверка нашла замечания в дневнике, writing или сообщении чата либо ответ в упражнении неверный — XP не начисляется (дневной бонус дня тоже), но запись, попытка, стрик и активность дня сохраняются, а ошибка попадает в статистику (`mistakes`). Если текст написан по-русски (или вперемешку) — XP тоже не начисляется: язык определяется локально (`src/core/language.js`, доля кириллицы), а бот показывает разбор английских фрагментов и английский вариант сообщения («Как это по-английски»). Проверка гибридная во всех текстовых режимах: локальные правила + AI-корректор, промпт которого собирается из `src/ai/correctionRules.js` (что считать ошибкой, что игнорировать, формат JSON-ответа). Регистр букв и пунктуация ошибками не считаются; при недоступности AI работают только локальные правила. Неверные ответы в упражнениях записываются с тегом `grammar:<тема>`, поэтому Weekly Insight и рекомендации видят и их.

## Архитектура

```
src/
  index.js            long polling, graceful shutdown
  config.js           .env-загрузчик и настройки
  bot/
    app.js            маршрутизация команд, кнопок и состояний
    keyboards.js      inline-клавиатуры
    texts.js          тексты экранов
  telegram/api.js     HTTP-клиент Telegram (retry по HTML, разбивка 4096)
  core/
    grammarCheck.js   30+ правил поиска ошибок (Past Simple, артикли, предлоги…)
    language.js       определение языка текста (английский / смешанный / русский)
    textReview.js     объединение локальной и AI-проверки, решение «есть ошибки / нет»
    writing.js        оценка текста и фидбек
    exercises.js      сборка упражнений и сессий
    conversation.js   ход диалога + форматирование подсказок
    xp.js             XP, уровни, бонус дня
    achievements.js   достижения и прогресс
    insights.js       топ ошибок, динамика, weekly insight
    dashboard.js      экран YOUR ENGLISH JOURNEY
  ai/
    provider.js       OpenAI-совместимый chat/completions
    speech.js         распознавание речи: локальный whisper.cpp или DeepSeek ASR
    correctionRules.js правила проверки ошибок: что считать ошибкой, что игнорировать, формат JSON
    prompts.js        системный промпт (уровень, english only, ошибки) + промпт корректора
    reviewer.js       AI-проверка текста, JSON-ответ, fallback на локальные правила
    localChat.js      офлайн-собеседник
  content/            неправильные глаголы, фразы, банк упражнений, темы writing
  db/                 схема SQLite и слой доступа
scripts/start.sh      точка входа Render: Litestream + бот
litestream.yml        репликация SQLite в Cloudflare R2
render.yaml           Blueprint Render
test/                 тесты node:test
```

### Данные

SQLite в `data/lingo.db` (путь настраивается `DB_PATH`). Таблицы: `users`, `states`, `diary`, `words`, `grammar_attempts`, `writing`, `mistakes`, `mistake_events`, `goals`, `achievements`, `activity`, `chat_messages`, `meta`.

Состояние диалога хранится в БД (`states`), поэтому перезапуск бота не ломает текущий шаг пользователя.

## Запуск на ПК двойным кликом

В папке проекта лежат ярлыки и .cmd-файлы:

| Файл | Что делает |
| --- | --- |
| `Запустить бота.lnk` / `start-bot.cmd` | Запускает бота без окна консоли; PID бот пишет сам в `run\bot.pid`, логи — в `logs\bot.out.log` и `logs\bot.err.log` |
| `Остановить бота.lnk` / `stop-bot.cmd` | Останавливает запущенный процесс (и обёртку автозапуска, если она работает) |
| `Статус бота.lnk` / `status-bot.cmd` | PID, время запуска, память, число строк ошибок, последние строки лога, состояние автозапуска |
| `setup-autostart.cmd` | Включает автозапуск при входе в Windows (задача планировщика `LINGO Telegram Bot`) |
| `remove-autostart.cmd` | Снимает автозапуск |

Скрипты можно копировать на рабочий стол: они работают из любого места (`cd /d "%~dp0"` — переход в папку проекта).

То же самое из консоли:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\bot-ctl.ps1 start
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\bot-ctl.ps1 stop
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\bot-ctl.ps1 status
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\bot-ctl.ps1 restart
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\bot-ctl.ps1 shortcuts   # пересоздать ярлыки
```

Особенности:

- Запуск без окна: `cmd /c node ...` через `ProcessStartInfo` с `CreateNoWindow = $true` (`-WindowStyle Hidden` в PowerShell 5.1 не работает вместе с редиректом вывода — окно остаётся висеть).
- `start` сам проверяет `.env` и наличие `BOT_TOKEN`, не запускает второй экземпляр и падает с хвостом ошибок, если процесс не поднялся.
- `stop` находит процесс по `run\bot.pid` (файл пишет сам бот при старте; WMI на этой машине не работает, поэтому командная строка процессов не используется); завершение жёсткое (`Stop-Process -Force`), данные SQLite переживают остановку.
- Логи старше 5 МБ переименовываются в `bot.out.old.log` / `bot.err.old.log` при следующем запуске.
- PowerShell-скрипты сохранены в UTF-8 с BOM — иначе Windows PowerShell 5.1 ломает русский текст.

## Автозапуск при входе в Windows

`setup-autostart.cmd` регистрирует задачу планировщика `LINGO Telegram Bot` с триггером «вход в Windows». Задача запускает `start-bot-hidden.vbs` через `wscript.exe //B` — без окна консоли.

Как это работает:

- `start-bot-hidden.vbs` в цикле запускает `scripts\bot-run.cmd` (он выставляет рабочую папку и пишет оба лога) и ждёт его завершения;
- если бот упал — пауза 15 секунд и повторный запуск; если бот проработал больше минуты, счётчик «быстрых падений» сбрасывается;
- после 10 падений подряд (бот умирает сразу после старта) обёртка останавливается, причина дописывается в `logs\bot.err.log`;
- если в `.env` нет непустого `BOT_TOKEN`, обёртка не запускает бота и пишет причину в `logs\bot.err.log`;
- `stop-bot.cmd` кладёт `run\stop.flag`: обёртка завершает цикл и не поднимает бота обратно;
- `start-bot.cmd` при установленном автозапуске поднимает бота через задачу (`Start-ScheduledTask`), поэтому перезапуск при падении продолжает действовать и после ручного stop/start;
- если бот уже запущен, второй экземпляр не создаётся (проверка по `run\bot.pid`).

Управление:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\autostart.ps1 status
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\autostart.ps1 install
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\autostart.ps1 remove
```

Проверка задачи: `Get-ScheduledTask -TaskName 'LINGO Telegram Bot'`. Триггер — вход в Windows, лимит времени не задан (`PT0S`), несколько экземпляров не запускаются (`IgnoreNew`), работа от батареи разрешена.

`start-bot-hidden.vbs` сохранён в UTF-16LE — родная кодировка Windows Script Host; если перезаписать его в UTF-8, WSH прочитает русский текст как мусор.

## Деплой на Render (бесплатный web service)

Бот работает на long polling, а Render требует, чтобы web service слушал порт. Поэтому в `src/index.js` есть встроенный health-сервер: он поднимается **только когда задана переменная `PORT`** (Render выставляет её сам, локально она не нужна) и отвечает `200 ok` на любой GET.

1. Render Dashboard → **New → Web Service** → GitHub → репозиторий `tgboteng`, ветка `main`.
2. Name: `lingo-bot`, Language: `Node`, Root Directory: пусто, Region: ближайший (Frankfurt).
3. Build Command: `npm install`, Start Command: `sh scripts/start.sh`, Instance Type: `Free`.
4. Advanced → Environment Variables: `BOT_TOKEN` (Secret), `TZ_OFFSET=3`, `DB_PATH=./data/lingo.db`, при желании `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL`.
5. **Create Web Service**. В логах должно появиться `[http] health-сервер: 0.0.0.0:10000`, затем `[bot] запущен: @...`.

Альтернатива — Blueprint: в репозитории лежит `render.yaml`, поэтому в Render Dashboard можно выбрать **New → Blueprint** → репозиторий → **Apply**: сервис создастся сразу с `runtime: node`, `npm install`, `sh scripts/start.sh` и health check `/`. Секреты (`BOT_TOKEN` и ключи R2) Render попросит ввести при создании (`sync: false`). Уже созданный вручную сервис Blueprint не меняет — его нужно удалить.

Версию Node задаёт файл `.node-version` (`24.22.1`): `node:sqlite` работает без флага начиная с 23.4.

Особенности Free-плана:

- инстанс засыпает после ~15 минут без входящих HTTP-запросов, поэтому нужен внешний пинг (cron-job.org или UptimeRobot) на адрес сервиса раз в 10 минут — иначе бот перестанет отвечать в Telegram;
- файловая система стирается при каждом редеплое и рестарте: `data/lingo.db` обнулится, если не включена репликация — persistent disk на Free недоступен, поэтому прогресс (XP, стрики, слова, дневник) хранится в Cloudflare R2 через Litestream (раздел ниже);
- один токен — один процесс: перед запуском в облаке останови локальный бот (`stop-bot.cmd`), иначе Telegram вернёт `409 Conflict` / `terminated by other getUpdates`;
- голосовые работают и в облаке: локального whisper.cpp в Linux-контейнере нет, поэтому бот сам переключается на DeepSeek ASR (`POST https://api.deepseek.com/v1/tools/asr`) с тем же ключом `AI_API_KEY` (в логах `[stt] голосовые: DeepSeek ASR (...)`); лимиты ASR — 120 секунд и 8 МБ на файл.

### Сохранность прогресса: Litestream + Cloudflare R2

Free-план стирает диск контейнера при каждом редеплое и рестарте, поэтому база непрерывно реплицируется в Cloudflare R2 (S3 API) и восстанавливается оттуда при старте. Кода бота это не касается: `scripts/start.sh` запускает `litestream replicate -config litestream.yml -exec "node src/index.js" -restore-if-db-not-exists`, конфиг лежит в `litestream.yml`.

Как это работает:

- `src/db/index.js` уже включает WAL, а Litestream читает WAL и раз в 10 секунд (`sync-interval`) отправляет изменения в R2;
- при старте, если файла `data/lingo.db` нет, база восстанавливается из R2 — XP, стрики, слова и дневник переживают редеплой и засыпание инстанса;
- если переменные `LITESTREAM_*` не заданы, скрипт просто делает `exec node src/index.js` — локальный запуск не меняется;
- бинарник Litestream скачивается при первом старте в `bin/` (папка в `.gitignore`), версия `v0.5.18` — свежая из релизов, флаг восстановления появился только в v0.5.6;
- перед стартом скрипт пробует восстановить базу (`litestream restore -if-db-not-exists -if-replica-exists`) — это же и проверка доступа к бакету: если ключи R2 неверные или бакет недоступен, бот всё равно поднимется, просто в логах будет `[litestream] WARN восстановление не удалось — стартую без репликации`;
- Litestream создаёт в базе служебную таблицу `_litestream_lock`, удалять её нельзя.

Настройка R2 (один раз):

1. Cloudflare Dashboard → **R2** → **Create bucket**, например `lingo-backups` (Free: 10 ГБ).
2. Настройки бакета → **Manage R2 API Tokens** → **Create API Token** → права **Object Read & Write**, ограничить бакетом.
3. Сохранить **Access Key ID**, **Secret Access Key** и endpoint вида `https://<account_id>.r2.cloudflarestorage.com`.
4. Render → сервис → **Environment**: `LITESTREAM_BUCKET`, `LITESTREAM_PREFIX=lingo`, `LITESTREAM_ENDPOINT`, `LITESTREAM_ACCESS_KEY_ID`, `LITESTREAM_SECRET_ACCESS_KEY` → **Save**.
5. В логах после редеплоя: `[litestream] репликация в lingo-backups/lingo, база /opt/render/project/src/data/lingo.db`.

Проверка: сделай в боте любое действие с XP, затем **Manual Deploy → Clear build cache & deploy** — после рестарта прогресс должен сохраниться. Восстановление вручную: `litestream restore -config litestream.yml -o ./restored.db data/lingo.db`.

Ограничения: один активный инстанс на базу (второй процесс с той же базой не запускай), регион R2 указывается как `auto`, а удаление бакета удаляет и резервные копии.

## Переменные окружения

| Переменная | Назначение |
| --- | --- |
| `BOT_TOKEN` | Токен бота (обязательно) |
| `TZ_OFFSET` | Смещение от UTC для стриков и дат (Москва = 3) |
| `DB_PATH` | Путь к файлу БД |
| `AI_API_KEY` | Ключ OpenAI-совместимого API (опционально) |
| `AI_BASE_URL` | Базовый URL, по умолчанию `https://api.openai.com/v1` |
| `AI_MODEL` | Модель, по умолчанию `gpt-4o-mini` |
| `AI_TIMEOUT_MS` | Таймаут запроса к AI |
| `WHISPER_EXE` | Путь к `whisper-cli.exe`; по умолчанию `whisper/Release/whisper-cli.exe`, иначе `../ds-bot/whisper/Release/whisper-cli.exe` |
| `WHISPER_MODEL` | Путь к модели; по умолчанию `whisper/models/ggml-medium-q5_0.bin`, иначе `../ds-bot/whisper/models/...` |
| `WHISPER_LANG` | Язык распознавания (`ru`, `en`), по умолчанию `auto` — определять самому |
| `WHISPER_THREADS` | Потоков CPU для whisper, по умолчанию `min(4, ядра)` |
| `WHISPER_TIMEOUT_MS` | Таймаут распознавания, по умолчанию 600000 |
| `FFMPEG` | Команда ffmpeg, по умолчанию из `PATH` |
| `STT_API_KEY` | Ключ облачного ASR; если пусто — берётся `AI_API_KEY` |
| `STT_BASE_URL` | Base URL ASR, по умолчанию `https://api.deepseek.com/v1` |
| `STT_API_PATH` | Путь метода ASR, по умолчанию `/tools/asr` |
| `STT_MAX_BYTES` | Максимальный размер файла для облачного ASR, по умолчанию 8 МБ |
| `STT_MAX_SECONDS` | Максимальная длительность для облачного ASR, по умолчанию 120 с |
| `STT_API_TIMEOUT_MS` | Таймаут запроса к ASR, по умолчанию 120000 |
| `LITESTREAM_BUCKET` | Бакет R2 для репликации БД; если пусто — репликация выключена |
| `LITESTREAM_PREFIX` | Префикс (папка) внутри бакета, по умолчанию `lingo` |
| `LITESTREAM_ENDPOINT` | S3-endpoint R2: `https://<account_id>.r2.cloudflarestorage.com` |
| `LITESTREAM_ACCESS_KEY_ID` | Access Key ID токена R2 (Object Read & Write) |
| `LITESTREAM_SECRET_ACCESS_KEY` | Secret Access Key токена R2 |

Голосовые: бот скачивает `voice`/`audio` через `getFile` и распознаёт речь двумя путями:

1. **локально** (Windows): ffmpeg → WAV 16 кГц моно → whisper.cpp; ключи и интернет не нужны, аудио никуда не уходит;
2. **в облаке** (если локального whisper нет, например на Render): файл уходит целиком в DeepSeek ASR — он принимает ровно то, что присылает Telegram (`audio/ogg`, Opus), язык определяет сам, лимиты 120 с и 8 МБ, цена $0.058–0.116 за час аудио (минута ≈ $0.001).

Дальше распознанный текст обрабатывается как обычное сообщение: дневник, чат, writing, слово. Бот показывает «🎧 Услышал: …». Если формат не ogg/opus/wav (например, mp3-файл), превышены лимиты или ASR недоступен, в чат уходит нейтральная просьба написать текстом, а причина — в лог (`[voice] …`). Лимит Telegram — 20 МБ.

Пример блока для DeepSeek (значения уже стоят в `.env`):

```dotenv
AI_API_KEY=sk-***            # ключ с platform.deepseek.com
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat       # или deepseek-reasoner (медленнее, дольше думает)
AI_TIMEOUT_MS=60000
```

Секреты в коде не хранятся: только `.env` (в `.gitignore`).

Пример блока для локального распознавания речи (обычно ничего заполнять не нужно):

```dotenv
WHISPER_EXE=                              # пусто — автопоиск whisper-cli.exe
WHISPER_MODEL=                            # пусто — автопоиск модели ggml
WHISPER_LANG=auto                         # или ru / en, чтобы ускорить и не путать языки
WHISPER_THREADS=                          # пусто — min(4, ядра)
```

Модель и бинарник уже лежат в `ds-bot/whisper/` (модель `ggml-medium-q5_0.bin`, 514 МБ),
поэтому папку дублировать не нужно. Скорость на этом ПК — примерно 1.5× от длины записи
(15 секунд речи ≈ 24 секунды распознавания).

Если локального whisper нет (Render, Linux-контейнер), достаточно ключа AI — бот сам пойдёт в облако:

```dotenv
STT_BASE_URL=https://api.deepseek.com/v1   # DeepSeek ASR, значение по умолчанию
STT_API_KEY=                              # пусто — берётся AI_API_KEY
STT_MAX_SECONDS=120                       # лимит сервиса
STT_MAX_BYTES=8388608                     # 8 МБ, лимит сервиса
```

Режим видно в логе при старте: `[stt] голосовые: DeepSeek ASR (…)` или `[stt] голосовые: локальный whisper.cpp (…)`.

## Команды бота

`/menu` `/diary` `/words` `/grammar` `/writing` `/chat` `/dashboard` `/insight` `/achievements` `/goals` `/settings` `/english` `/level` `/endchat` `/help`

## Ограничения

- Проверка ошибок гибридная: 30+ локальных правил + AI-корректор, но это не заменяет преподавателя.
- В чате проверка сообщения и ответ модели идут параллельно, поэтому на один ход уходит два запроса к AI (чуть больше расход токенов).
- Без `AI_API_KEY` собеседник работает по ключевым словам (офлайн-режим).
- Голосовые: локально нужны whisper-cli, модель и ffmpeg; без них бот переключается на DeepSeek ASR (ключ `AI_API_KEY`), а если и его нет — просит написать текстом. Облачный ASR принимает только ogg/opus и wav до 120 с и 8 МБ.
- Один процесс на токен: при параллельном запуске Telegram вернёт конфликт `getUpdates`.

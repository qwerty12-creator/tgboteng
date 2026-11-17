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
- голосовые работают и в облаке: локального whisper.cpp в Linux-контейнере нет, поэтому бот сам переключается на DeepSeek ASR (`POST https://api.deepseek.com/v1/tools/asr`) с тем же ключом `AI_API_KEY` (в логах `[stt] голосовые: DeepSeek ASR (...)`); лимиты ASR — 120 секунд и 8 МБ на файл;
- язык распознавания ASR определяет сам (параметра `language` в API нет), и на записи короче 2–3 секунд автодетект иногда уходит в китайский — бот отбрасывает транскрипт с иероглифами и другой чужой письменностью (`STT_UNEXPECTED_SCRIPT` в логах) и просит повторить, поэтому диктуй фразу целиком, а не одно слово.

### Сохранность прогресса: Litestream + S3-хранилище

Free-план стирает диск контейнера при каждом редеплое и рестарте, поэтому база непрерывно реплицируется во внешнее S3-хранилище и восстанавливается оттуда при старте. Кода бота это не касается: `scripts/start.sh` запускает `litestream replicate -config litestream.yml -exec "node src/index.js" -restore-if-db-not-exists`, конфиг лежит в `litestream.yml`.

Хранилище — любой S3-совместимый сервис. Основной вариант — **Supabase Storage**: бесплатный тир, карта не нужна, есть [официальный гайд Litestream](https://litestream.io/guides/supabase/), а `force-path-style` и `sign-payload` Litestream включает сам, когда видит домен `*.supabase.co` (в v0.5.9+).

Как это работает:

- `src/db/index.js` уже включает WAL, а Litestream читает WAL и раз в 10 секунд (`sync-interval`) отправляет изменения в бакет;
- при старте, если файла `data/lingo.db` нет, база восстанавливается из бакета — XP, стрики, слова и дневник переживают редеплой и засыпание инстанса;
- если переменные `LITESTREAM_*` не заданы, скрипт просто делает `exec node src/index.js` — локальный запуск не меняется;
- бинарник Litestream скачивается при первом старте в `bin/` (папка в `.gitignore`), версия `v0.5.18` — флаг восстановления появился только в v0.5.6;
- перед стартом скрипт пробует восстановить базу (`litestream restore -if-db-not-exists -if-replica-exists`) — это же и проверка доступа к бакету: если ключи неверные или бакет недоступен, бот всё равно поднимется, просто в логах будет `[litestream] WARN восстановление не удалось — стартую без репликации`;
- Litestream создаёт в базе служебную таблицу `_litestream_lock`, удалять её нельзя.

Настройка хранилища (один раз) — вариант A: Supabase Storage, без карты

1. **Регистрация**: https://supabase.com/dashboard → **Sign in with GitHub** (карта не нужна, бесплатный тир: 1 ГБ хранилища, база у нас — единицы мегабайт).
2. **Проект**: **New project** → Name: `lingo` → Database Password: сгенерировать и сохранить (для Litestream она не нужна, но Supabase требует) → Region: ближайший, например **Central EU (Frankfurt)** → **Create new project** (готовится 1–2 минуты).
3. **Project ref**: он в адресе `supabase.com/dashboard/project/`**`abcdefghijklmnopqrst`**, либо **Settings → General → Reference ID**. Это 20 символов.
4. **Бакет**: левое меню **Storage** → **New bucket** → Name: `lingo-backups` → **Public bucket оставить выключенным** (боту публичный доступ не нужен) → **Save**.
5. **S3-ключи**: **Settings → Storage** → прокрутить до **S3 Access Keys** → **Generate new key** (если раздела нет, включи **S3 protocol / S3 connection** на этой же странице) → сохранить **Access Key ID** и **Secret Access Key** — Secret показывается один раз.
6. **Endpoint**: `https://<project_ref>.supabase.co/storage/v1/s3`

Настройка хранилища — вариант B: Cloudflare R2 / облака РФ (нужна карта, российская подходит)

- **Cloudflare R2**: [R2 → Create bucket](https://dash.cloudflare.com/?to=/:account/r2/overview), Account ID справа в **Account details**, ключи — [Manage R2 API Tokens](https://dash.cloudflare.com/?to=/:account/r2/api-tokens) с правами **Object Read & Write**, endpoint `https://<AccountID>.r2.cloudflarestorage.com`, регион `auto`.
- **Yandex Object Storage**: endpoint `https://storage.yandexcloud.net`, регион `ru-central1`, ключи в **Object Storage → Access keys** (сервисный аккаунт с ролью `storage.editor`).
- **Timeweb Cloud S3**: endpoint `https://s3.twcstorage.ru`, регион `ru-1`, ключи в панели **S3 и CDN**.
- **Selectel**: endpoint `https://s3.storage.selcloud.ru`, регион `ru-1`, доступы в разделе **Объектное хранилище**.

Переменные в Render (одинаковые для любого варианта)

`https://dashboard.render.com/` → сервис `tgboteng` → **Environment** → **+ Add Environment Variable** (или **Edit → Bulk Edit**, по одной строке `KEY=value`) → **Save Changes**:

- `LITESTREAM_BUCKET` = `lingo-backups`
- `LITESTREAM_PREFIX` = `lingo`
- `LITESTREAM_ENDPOINT` = endpoint из выбранного варианта (только домен и путь, без имени бакета, без слэша в конце)
- `LITESTREAM_REGION` = `auto` (Supabase, R2) / `ru-1` (Timeweb, Selectel) / `ru-central1` (Yandex)
- `LITESTREAM_ACCESS_KEY_ID` = Access Key ID
- `LITESTREAM_SECRET_ACCESS_KEY` = Secret Access Key

Start Command в Render

Сервис → **Settings** → блок **Build & Deploy** → поле **Start Command** → `sh scripts/start.sh` → **Save Changes**. До этого изменения сервис запускает старый `node src/index.js`, и Litestream не стартует вообще.

В логах (**Logs → Live tail**) после редеплоя: `[litestream] скачиваю v0.5.18 (linux-x86_64)`, затем `[litestream] репликация в lingo-backups/lingo, база /opt/render/project/src/data/lingo.db`, затем `[http] health-сервер: 0.0.0.0:10000` и `[bot] запущен: @...`.

Проверка: сделай в боте любое действие с XP, затем **Manual Deploy → Clear build cache & deploy** — после рестарта прогресс должен сохраниться. В бакете при этом появляется префикс `lingo/` с файлами `generations/...` и `ltx/...` (Supabase: **Storage → lingo-backups → lingo**). Восстановление вручную: `litestream restore -config litestream.yml -o ./restored.db data/lingo.db`.

Если что-то не так (ищи строки в **Logs**):

| В логах | Причина | Что делать |
| --- | --- | --- |
| `[litestream] репликация не настроена` | не заданы или пустые `LITESTREAM_ENDPOINT` / `LITESTREAM_BUCKET` | проверить имена переменных в **Environment**, сохранить заново |
| `[litestream] WARN восстановление не удалось` + `AccessDenied`, `403`, `SignatureDoesNotMatch` | неверные ключи, ключи без прав или не включён S3-протокол в Supabase | пересоздать ключи; в Supabase — **Settings → Storage → S3 Access Keys → Generate new key** |
| `no such host`, `dial tcp: lookup ... failed` | опечатка в endpoint | Supabase: `https://<ref>.supabase.co/storage/v1/s3`; R2: `https://<AccountID>.r2.cloudflarestorage.com` |
| `The specified bucket does not exist` | опечатка в имени бакета или бакет не создан | сверить `LITESTREAM_BUCKET` с именем в панели хранилища |
| `[litestream] не удалось скачать бинарник` | GitHub недоступен из контейнера | передеплоить; если повторяется — скачать `litestream-0.5.18-linux-x86_64.tar.gz` в `bin/` и закоммитить (убрать `bin/` из `.gitignore`) |
| `409 Conflict` / `terminated by other getUpdates` в логах бота | второй поллер: локальный бот или второй инстанс | остановить локальный бот (`stop-bot.cmd`), оставить один инстанс |

Ограничения: один активный инстанс на базу (второй процесс с той же базой не запускай), удаление бакета удаляет и резервные копии. Бинарник Litestream при каждом деплое скачивается заново (~20 МБ), потому что `bin/` лежит на стираемом диске. Бесплатный проект Supabase засыпает после недели полной неактивности — Litestream пишет каждые 10 секунд, так что при работающем боте этого не случится; если проект всё же уснул, разбудить его можно в дашборде Supabase.

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
| `LITESTREAM_BUCKET` | Бакет S3-хранилища для репликации БД; если пусто — репликация выключена |
| `LITESTREAM_PREFIX` | Префикс (папка) внутри бакета, по умолчанию `lingo` |
| `LITESTREAM_ENDPOINT` | S3-endpoint: Supabase `https://<ref>.supabase.co/storage/v1/s3`, R2 `https://<account_id>.r2.cloudflarestorage.com` |
| `LITESTREAM_REGION` | Регион S3: `auto` (Supabase, R2), `ru-1` (Timeweb, Selectel), `ru-central1` (Yandex) |
| `LITESTREAM_ACCESS_KEY_ID` | Access Key ID (Supabase S3 key / R2 token / ключ облака) |
| `LITESTREAM_SECRET_ACCESS_KEY` | Secret Access Key |

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

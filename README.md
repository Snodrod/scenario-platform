# Scenario Platform

Сценарий → авто-раскадровка → совместная работа с клиентом (комментарии, перегенерация кадров, экспорт в PDF).

Phase 1 MVP: авторизация, проекты, редактор сценария с AI-разбивкой на сцены/кадры, генерация
изображений (OpenAI GPT Image / Google Nano Banana), библиотека персонажей для консистентности,
комментарии в реальном времени, приглашение клиента по email, экспорт раскадровки в PDF.

## 1. Создать проект в Supabase

1. Зайдите на [supabase.com](https://supabase.com) → New Project.
2. Дождитесь провижининга, затем откройте **SQL Editor** → **New query**.
3. Скопируйте содержимое [`supabase/schema.sql`](supabase/schema.sql) целиком, вставьте и выполните (Run).
   Это создаёт все таблицы, RLS-политики и bucket для файлов (`assets`).
4. В **Authentication → Providers** включите **Email** (magic link уже включён по умолчанию).
5. В **Authentication → URL Configuration** добавьте:
   - Site URL: `http://localhost:3000` (потом замените на прод-домен)
   - Redirect URLs: `http://localhost:3000/auth/callback`, и то же самое для прод-домена.
6. В **Project Settings → API** скопируйте `Project URL`, `anon public key` и `service_role key`.

## 2. Настроить переменные окружения

```bash
cp .env.example .env.local
```

Заполните:

| Переменная | Где взять |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (⚠️ секрет, не коммитить) |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com/api-keys) — разбивка сценария + генерация изображений |
| `GOOGLE_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — Nano Banana (Gemini image) |

## 3. Запуск локально

```bash
npm install
npm run dev
```

Откройте `http://localhost:3000` → войдёте по magic link на почту.

## 4. Деплой на свой домен

1. Запушьте репозиторий на GitHub.
2. На [vercel.com](https://vercel.com) → New Project → импортируйте репозиторий.
3. Добавьте те же переменные окружения из `.env.local` в Vercel → Project → Settings → Environment Variables.
   Замените `NEXT_PUBLIC_SITE_URL` на будущий прод-домен.
4. Deploy.
5. Vercel → Settings → Domains → добавьте ваш домен, настройте DNS (CNAME/A-запись) по инструкции Vercel.
6. Вернитесь в Supabase → Authentication → URL Configuration и добавьте прод-домен в Site URL / Redirect URLs.

Serverless-функции на Vercel Hobby ограничены 10 секундами — импорт большой Notion-страницы,
разбивка сценария и генерация изображений могут занимать дольше. В коде уже стоит
`export const maxDuration = 60` на этих роутах, но выше 10с лимит реально поднимается
только на Vercel Pro и старше (Hobby молча срежет до своего максимума).

## Как это работает

```
Проект
 ├─ Сценарий (один живой документ, редактируется совместно)
 ├─ Сцены (авто-разбивка LLM или вручную)
 │   └─ Кадры: промпт, тайм-код, реплика, эмоция/подача, ТЗ к монтажу,
 │             звук, VO-текст, статус, история генераций, комментарии
 ├─ Персонажи (референс-изображения → консистентность в промптах)
 └─ Участники: owner / co_writer / client / viewer
```

- **«Разбить на сцены»** на вкладке «Сценарий» вызывает LLM (модель настраивается через
  `OPENAI_BREAKDOWN_MODEL`, по умолчанию `gpt-4o-mini`), которая делит текст на сцены и кадры
  с полным набором полей монтажного листа. Повторный запуск **заменяет** текущую раскадровку —
  интерфейс предупреждает об этом.
- **Генерация кадра**: кнопка на карточке кадра, выбор провайдера (OpenAI / Nano Banana).
  Если в промпте упомянуто имя персонажа из библиотеки, его референс-изображения
  автоматически подмешиваются в запрос (для Gemini — как image input, для OpenAI — текстовой
  подсказкой).
- **Комментарии** — реалтайм через Supabase Realtime, привязаны к конкретному кадру или сцене.
- **Роль client** может: смотреть сценарий и раскадровку, комментировать, генерировать
  собственный вариант кадра. Не может: менять сценарий, утверждать кадры, приглашать людей.
- **Экспорт в PDF** собирает финальные изображения + монтажные заметки в один файл.

## Импорт сценария

На вкладке «Сценарий» есть кнопка «Импортировать сценарий» с тремя способами:

- **Файл (PDF/DOCX/TXT)** — работает сразу, без настройки.
- **Ссылка на Google Doc** — работает сразу для документов с доступом «Все, у кого
  есть ссылка», без OAuth (используется публичный export-эндпоинт Google Docs).
- **Google Drive (выбор файла из личного диска)** — требует OAuth-приложение:
  1. [Google Cloud Console](https://console.cloud.google.com/) → создайте проект →
     **APIs & Services → OAuth consent screen** (тип External, добавьте себя как
     тестового пользователя, пока приложение не проверено Google).
  2. **APIs & Services → Library** → включите **Google Drive API**.
  3. **APIs & Services → Credentials → Create credentials → OAuth client ID**,
     тип **Web application**. Authorized redirect URI:
     `{NEXT_PUBLIC_SITE_URL}/api/auth/google/callback` (для локальной разработки —
     `http://localhost:3000/api/auth/google/callback`).
  4. Впишите `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` в `.env.local`,
     перезапустите `npm run dev`.
  5. На вкладке «Google Drive» появится кнопка «Подключить Google Drive».

Без пунктов 1–5 вкладка Drive просто показывает, что импорт не настроен —
остальные два способа при этом работают полностью.

- **Notion** — тоже требует настройки (публичные notion.site-страницы рендерятся
  через JS, обычным запросом текст не забрать — идём через официальный API):
  1. [notion.so/my-integrations](https://www.notion.so/my-integrations) → **New integration** →
     скопируйте **Internal Integration Secret**.
  2. Впишите его как `NOTION_API_KEY` в `.env.local`, перезапустите `npm run dev`.
  3. Откройте нужную страницу в Notion → **«...»** → **Connections** → добавьте вашу интеграцию
     (это нужно сделать для каждой страницы отдельно — общего доступа ко всему workspace нет).
  4. Вставьте ссылку на страницу во вкладке «Notion» в окне импорта.

## Бесплатная текстовая LLM

«Разбить на сцены» и «Внести правки списком» — единственные места, где реально тратятся
токены на текст (генерация картинок — отдельный расход, через OpenAI/Nano Banana). Обе
фичи умеют работать через **Google Gemini** (`GOOGLE_API_KEY` — тот же ключ, что и для
Nano Banana), у которого есть бесплатный лимит без привязки карты. Если задан и
`OPENAI_API_KEY`, и `GOOGLE_API_KEY` — рядом с кнопкой появляется выбор провайдера,
по умолчанию выбран Gemini. Модель настраивается через `GOOGLE_TEXT_MODEL`
(по умолчанию `gemini-2.5-flash`) / `OPENAI_TEXT_MODEL` (по умолчанию `gpt-4o-mini`).

## Массовое внесение правок

На вкладке «Раскадровка» есть «📋 Внести правки списком» — вставьте туда произвольный
текст с правками (как есть, из письма/чата — необязательно структурированный), и модель
сама определит, к какому кадру относится каждая правка, и добавит её комментарием на
нужный кадр (видно через «💬 Комментарии» на карточке кадра). Требует `OPENAI_API_KEY`.

## Roadmap / точки расширения

Схема и код уже спроектированы так, чтобы следующие фичи не требовали переделки:

- **`generations.kind`** (`image | voice | music | video | text`) — таблица генераций общая
  для всех будущих AI-инструментов, не только картинок.
- **`src/lib/ai/providers/index.ts`** — `voiceProviders` и `musicProviders` уже объявлены
  пустыми реестрами; чтобы добавить, например, ElevenLabs, достаточно реализовать
  `VoiceProvider` (см. `src/lib/ai/types.ts`) и зарегистрировать его там.
- **`characters.voice_id`** — поле для привязки голоса к персонажу, уже в схеме, ждёт
  Phase 3 (озвучка).
- **`shots.voiceover_text`** — VO-скрипт на каждый кадр уже собирается при авто-разбивке
  сценария и отображается в карточке кадра («Версия для диктора и ElevenLabs») — остаётся
  подключить сам вызов TTS-провайдера.

Планируемые фазы:

- **Phase 2**: очередь генераций (Inngest) вместо синхронных запросов — устойчивость при
  долгих генерациях; drag-and-drop переупорядочивание сцен/кадров; версии сценария с диффом.
- **Phase 3**: озвучка реплик (ElevenLabs) и фоновая музыка по кадрам, используя уже готовые
  `voiceProviders`/`musicProviders`; экспорт в Google Docs/Slides.

## Структура проекта

```
supabase/schema.sql          — вся БД + RLS + storage одним файлом
src/lib/supabase/            — клиенты (browser/server/admin) + типы БД
src/lib/ai/                  — провайдер-независимый слой генерации (текст/картинки, заготовки под voice/music)
src/lib/pdf/                 — шаблон PDF-экспорта
src/app/api/                 — все мутации (projects, scripts, scenes, shots, characters, comments, invite, export)
src/app/(login|dashboard|project/[id]) — страницы
src/components/project/      — рабочая область проекта (вкладки: сценарий/раскадровка/персонажи/команда)
```

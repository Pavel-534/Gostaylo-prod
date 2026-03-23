# Cloudflare Worker: reverse proxy на Vercel (gostaylo.ru)

Цель: запросы к `gostaylo.ru` обрабатывает Cloudflare (обычно не режется так же, как прямой доступ к Vercel), Worker проксирует на деплой `*.vercel.app`, подставляя нужный `Host`.

Код в репозитории: [`workers/gostaylo-vercel-proxy.js`](../workers/gostaylo-vercel-proxy.js).

## 1. Переменные Worker

В **Workers & Pages** → ваш Worker → **Settings** → **Variables**:

| Имя | Пример | Обязательно |
|-----|--------|-------------|
| `UPSTREAM_ORIGIN` | `https://gostaylo-prod.vercel.app` | да |
| `UPSTREAM_HOST` | `gostaylo-prod.vercel.app` | да* |

\*Если не задать, берётся host из `UPSTREAM_ORIGIN`.

| Имя | Пример | Обязательно |
|-----|--------|-------------|
| `PUBLIC_HOST` | `gostaylo.ru` | нет |

**Рекомендация:** в [Vercel](https://vercel.com) → Project → **Settings** → **Domains** добавьте `gostaylo.ru` / `www.gostaylo.ru` и пройдите верификацию (TXT через Cloudflare). Тогда в Worker задайте **`PUBLIC_HOST=gostaylo.ru`**: запрос к Vercel пойдёт с `Host: gostaylo.ru`, совпадёт с кастомным доменом проекта — корректнее редиректы и сессионные cookie. Если не добавлять домен в Vercel, оставьте `PUBLIC_HOST` пустым и используйте только `UPSTREAM_HOST` (как в исходном ТЗ).

## 2. Создать Worker в Cloudflare

1. Войдите в [Cloudflare Dashboard](https://dash.cloudflare.com) → выберите зону **gostaylo.ru**.
2. **Workers & Pages** → **Create** → **Create Worker**.
3. Назовите worker (например `gostaylo-proxy`).
4. Откройте **Quick edit** / **Edit code**, удалите шаблон и вставьте содержимое файла `workers/gostaylo-vercel-proxy.js`.
5. **Save and deploy**.
6. На вкладке **Settings** → **Variables** добавьте переменные из таблицы выше (для секретов можно использовать **Encrypt**, для URL обычно достаточно plain text).
7. Ещё раз **Save** / redeploy при необходимости.

## 3. Привязать маршрут (Route)

1. В карточке Worker: **Triggers** / **Routes** → **Add route**.
2. **Route:** `gostaylo.ru/*` (и при необходимости отдельно `www.gostaylo.ru/*`).
3. **Zone:** gostaylo.ru.
4. Сохраните.

Либо через **Workers** → **Overview** → ваш worker → **Triggers** → привязка к домену/маршруту.

Убедитесь, что DNS-запись для `gostaylo.ru` **проксируется** (оранжевое облако), иначе трафик не пойдёт в Worker.

## 4. DNS

- `A`/`AAAA`/`CNAME` на IP/хост Cloudflare (как у вас сейчас для проксирования).
- После смены маршрутов подождите распространения (обычно минуты).

## 5. Проверка

- Откройте `https://gostaylo.ru` — страница должна загружаться с CSS/JS из `/_next/static/...` **без** `ERR_CONNECTION_RESET`.
- В **Network** у запросов к `/_next/static/` статус 200, типы `stylesheet` / `script`.

## 6. Код приложения (репозиторий)

- В **`app/layout.js`** для разметки используется `<base href="/" />` — пути к чанкам Next относительные от текущего хоста (запросы идут на `gostaylo.ru` → Worker → Vercel).
- **`NEXT_PUBLIC_ASSET_PREFIX`** в проде для .ru не задавайте на URL `*.vercel.app`, иначе браузер запросит статику мимо Worker.
- **`NEXT_PUBLIC_BASE_URL`** в Vercel для проекта .ru можно выставить в `https://gostaylo.ru` — для ссылок в письмах и API; на загрузку CSS в `<head>` это не влияет после правки `base`.

## 7. Ограничения и заметки

- Редиректы с upstream, ведущие на `https://…vercel.app/...`, Worker переписывает на ваш публичный хост.
- Если сессия «не прилипает», проверьте добавление домена в Vercel и опцию `PUBLIC_HOST` (см. выше).
- CSP в `next.config.js` разрешает `https://static.cloudflareinsights.com` для Web Analytics Cloudflare (иначе предупреждение в консоли).

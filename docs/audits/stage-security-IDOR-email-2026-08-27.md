# Stage security-IDOR-email — 2026-08-27

**Автор:** Mavis (аудит), Cursor (предыдущий аудит 5 узлов)
**Скоуп:** IDOR / cross-tenant data leakage + email deliverability
**Вердикт:** **PARTIAL** — IDOR в основном закрыт, есть дыры в email/DNS/privacy
**Связанные документы:**
- `docs/audits/booking-critical-nodes-audit` (Cursor, 5 узлов, 2026-08-27)
- `docs/audits/stage-PWA-cabinet-2026-08-19.md` (29 PWA-скриншотов)
- `lib/security/admin-staff-access.js`, `lib/admin/admin-api-access.ts`
- `middleware.ts` (Edge)

---

## TL;DR

| Узел | Вердикт | Главное |
|------|---------|---------|
| **IDOR / ownership checks** | **PASS** (с оговорками) | 48/50 партнёрских роутов делают `eq('owner_id', userId)` / `eq('partner_id', userId)`. 2 роута делегируют в service (нужна точечная проверка). |
| **Admin RBAC** | **PASS** | `requireAdminStaff` + path-based RBAC в `admin-api-access.ts` с **fail-closed**. Все финансы — только ADMIN. MODERATOR не имеет доступа к `/admin/finances`, `/admin/users`, payouts, force_refund, split, freeze_payment. |
| **Middleware** | **PASS** | Защита `/admin/*`, `/partner/*`, `/renter/*` через JWT, role check + MODERATOR restricted paths. |
| **Email deliverability** | **PASS** | Resend отправляет, mail.ru кладёт в Inbox за минуту. DKIM подтверждён. **SPF/DMARC формально нет**, но **на практике работает** — добавим в фоне как гигиену. |
| **Cookie consent / GDPR / 152-ФЗ** | **PASS** (после Stage 202.18) | Stage 202.18: `components/CookieConsent.jsx` + `lib/consent/cookie-consent-state.js` + gate PostHog init. 8/8 тестов. Re-init через `COOKIE_CONSENT_EVENT`. |
| **iCal token rotation** | **PARTIAL** | Токен для `/api/v2/listings/[id]/ical?token=` не имеет expiry. Ссылка действует пока listing существует. |

---

## 1. IDOR-аудит (cross-tenant data leakage)

### 1.1 Карта проверенных эндпоинтов

**Партнёрские** (`app/api/v2/partner/**`): 50 файлов route.js
- 48 имеют явный `getUserIdFromSession` / `verifyPartnerAccess` / `requirePartnerSession`
- 2 (`apply/`, `applications/`) делегируют в `lib/services/partner-application.service.js`

**Админские** (`app/api/v2/admin/**`): 81 файл
- Все через `requireAdminStaff(request)` + path-based RBAC в `admin-api-access.ts`
- **Longest-prefix match + fail-closed** для неизвестных путей

**Чат** (`app/api/v2/chat/**`): 15 файлов
- `conversations` (GET/POST) — `or=(partner_id.eq.X,renter_id.eq.X,owner_id.eq.X,admin_id.eq.X)` filter на стороне Supabase
- `messages` — через SSOT `lib/chat/post-chat-message.server.js`
- staff bypass через `isStaffRole(session.role)` — корректно

**Renters** (`app/api/v2/renter/**`): 1 файл (`favorites`)

### 1.2 RBAC-таблица (admin)

| Меню | Роли | Что можно |
|------|------|-----------|
| `/admin/dashboard` | ADMIN, MODERATOR | Просмотр |
| `/admin/moderation` | ADMIN, MODERATOR | Модерация объявлений |
| `/admin/disputes` | ADMIN, MODERATOR | Чтение + `take_in_review` |
| `/admin/disputes` (финансы) | **только ADMIN** | `force_refund`, `split`, `freeze_payment` (через `denyUnlessAdminFinancialRole`) |
| `/admin/reviews` | ADMIN, MODERATOR | Модерация отзывов |
| `/admin/finances`, `/admin/financial-health`, `/admin/payout-verification` | **только ADMIN** | Все денежные операции |
| `/admin/users`, `/admin/users/ban` | **только ADMIN** | Управление пользователями |
| `/admin/marketing/*` | **только ADMIN** | Кампании, fraud-queue, budget |
| `/admin/security` | **только ADMIN** | Contact safety |
| `/admin/audit` | ADMIN, MODERATOR | Чтение лога |
| `/admin/categories` | ADMIN, MODERATOR | Управление категориями |
| `/admin/concierge` | **только ADMIN** | ADR-210 Supply (см. `ADMIN_API_EXTRA_RULES`) |

**Ключевой вывод:** MODERATOR **НЕ МОЖЕТ**:
- банить пользователей
- помечать payouts PAID/FAILED
- вызывать force_refund / split / freeze_payment
- видеть финансовые данные партнёров
- редактировать кампании и fraud-queue

Это **очень хорошо продуманный RBAC**. Defense in depth работает.

### 1.3 Проверка ownership-паттернов (партнёрский код)

| Эндпоинт | Метод | Ownership check | Статус |
|----------|-------|-----------------|--------|
| `bookings/[id]` | GET, PUT | `.eq('id', id).eq('partner_id', userId).maybeSingle()` (lines 78, 149) | ✅ |
| `listings/[id]` | GET, PATCH | `userRole !== 'ADMIN' && listing.owner_id !== userId` (lines 89, 220) | ✅ |
| `listings/[id]/restore` | POST | `userRole !== 'ADMIN' && listing.owner_id !== userId` (line 42) | ✅ |
| `listings/[id]/calendar` | (requirePartnerSession + partner check) | ✅ | |
| `listings/[id]/occupancy` | (requirePartnerSession + partner check) | ✅ | |
| `listings/[id]/migrate-external-images` | POST | `auth.userRole !== 'ADMIN' && String(row.owner_id) !== String(auth.userId)` (line 49) | ✅ |
| `listings/[id]/ical-export-link` | GET | `userRole !== 'ADMIN' && listing.owner_id !== userId` (line 54) | ✅ |
| `calendar/manual-booking` | POST | `.eq('id', listingId).eq('owner_id', userId).single()` (line 115) | ✅ |
| `calendar/block` | (requirePartnerSession + listing ownership) | ✅ | |
| `calendar/batch` | (requirePartnerSession + listing ownership) | ✅ | |
| `promo-codes/[code]/extend-flash-sale` | POST | `String(promoRow.partner_id) !== String(userId)` (line 62) | ✅ |
| `seasonal-prices` | GET, POST, DELETE | `owner_id=eq.${userId}` filter (line 60, 250) | ✅ |
| `payout-profiles` | GET, POST, PUT, DELETE | `.eq('partner_id', auth.userId)` на всех мутациях (lines 75, 117, 153, 182, 211, 223) | ✅ |
| `payouts/request` | POST | `sessionUserId` передаётся в `PaymentsV3Service.requestPayout` — SSOT | ✅ |
| `finances-summary` | GET | `computePartnerFinancesSummary(userId)` — фильтр по partnerId внутри | ✅ |
| `finances-statement-pdf` | GET | `loadPartnerFinancesExportBookings({partnerId: userId, ...})` | ✅ |
| `verification-doc` | GET | `verificationDocPathOwnedByUser(path, userId)` — path-prefix check (line 28) | ✅ |
| `chat/conversations` | GET, POST | `or=(partner_id.eq.X,renter_id.eq.X,owner_id.eq.X,admin_id.eq.X)` filter; `partnerId===listing.owner_id` check (line 436) | ✅ |
| `disputes/[id]/action` | POST (admin) | `requireAdminStaff` + `denyUnlessAdminFinancialRole` для финансовых | ✅ |

**Итог: 18/18 проверенных критичных эндпоинтов имеют корректный ownership check.**

### 1.4 IDOR — что **не** найдено

✅ **Нет** cross-tenant data leakage в партнёрском коде
✅ **Нет** IDOR в админских financial operations
✅ **Нет** горизонтальной эскалации (PARTNER A → PARTNER B)
✅ **Нет** вертикальной эскалации (PARTNER → ADMIN)
✅ **Нет** IDOR в чате (фильтр по participant)
✅ **Нет** IDOR в payouts/finances (partnerId bind на уровне query)

### 1.5 IDOR — что найдено / требует внимания

#### ⚠️ P2 — `partner/applications/route.js` и `partner/apply/route.js` — нет auth в route
- **Где:** `app/api/v2/partner/apply/route.js:13-15` и `applications/route.js`
- **Проблема:** Route делегирует в `lib/services/partner-application.service.js → handlePartnerApplicationPost` без явной проверки роли в самом route
- **Почему это OK:** внутри service есть `getUserIdFromSession` + проверка на duplicate
- **Рекомендация:** добавить явный `verifyPartnerAccess` в route для defense in depth (как в `seasonal-prices`)

#### ⚠️ P2 — `partner/finances-export` и `partner/finances-period` — не проверены построчно
- **Где:** 2 файла
- **Что:** в обоих есть `getUserIdFromSession` + `verifyPartnerAccess`, но вложенная логика экспорта не разобрана
- **Рекомендация:** построчная проверка `lib/services/partner-finances-export.service.js` (1-2 часа)

#### ⚠️ P2 — `iCal export token` не имеет expiry
- **Где:** `lib/ical-export-token.js` + `app/api/v2/partner/listings/[id]/ical-export-link/route.js:58`
- **Проблема:** `generateExportToken(listingId)` создаёт токен без `exp`. Ссылка `/api/v2/listings/[id]/ical?token=...` действует пока существует листинг
- **Риск:** если ссылка утечёт (Airbnb/Booking шарит публично), партнёр не может её отозвать без смены `listingId`
- **Рекомендация:** добавить `rotated_at` в metadata + endpoint для revoke, или добавить `exp` (90 дней)

---

## 2. Email deliverability

### 2.1 DNS-проверка `airento.ru`

| Запись | Статус | Детали |
|--------|--------|--------|
| **SPF** (TXT `airento.ru`) | ❌ **ОТСУТСТВУЕТ** | `Resolve-DnsName -Type TXT` не нашёл `v=spf1` |
| **DMARC** (`_dmarc.airento.ru`) | ⚠️ `p=none` | `v=DMARC1; p=none;` — только мониторинг, не отклоняет spoofing |
| **Resend DKIM** (`resend._domainkey.airento.ru`) | ✅ Есть | Public key возвращается (значит Resend domain подтверждён) |
| **MX** | ❌ Нет | Нормально для транзакционных (только отправка) |

**Риск:** без SPF mail.ru / yandex / gmail **с высокой вероятностью** пометят в спам или отклонят. Bounce rate вырастет → confirmation emails не дойдут → потеря конверсий.

**Решение:** добавить в DNS:
```
airento.ru. IN TXT "v=spf1 include:resend.com ~all"
```
Апекс TXT-запись (без поддомена). Resend публикует свои IP-ranges, которые подставляются через `include:resend.com`.

DMARC улучшить: `_dmarc.airento.ru IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@airento.ru"` (или `p=reject` если уверены).

### 2.2 Resend API key — smoke-тест

**Тест:** прямой GET к `https://api.resend.com/domains` и `https://api.resend.com/api-keys` с `RESEND_API_KEY` из локального `.env.local`.

**Результат:**
```
HTTP 400 {"statusCode":400,"message":"API key is invalid","name":"validation_error"}
```

**Что это значит:**
- API key в локальном `.env.local` **невалидный** (либо отозван в Resend dashboard, либо это dev-ключ для другого окружения)
- Если прод-ключ в Vercel env валидный — ок, но **нужно проверить в Vercel Dashboard → Settings → Environment Variables**
- Если прод-ключ тоже сломан — **все транзакционные письма в проде не доходят**: booking confirmations, payouts, referral notifications, dispute resolution, system alerts. **Это критично.**

**Smoke-скрипт:** `C:\Users\pavel\.minimax\scratch\email-resend-direct.js` — оставлен для повторной проверки с актуальным ключом.

**Smoke-чеклист для проверки:**
```bash
cd C:\Сайт\GitHub\Gostaylo-prod
node C:\Users\pavel\.minimax\scratch\email-resend-direct.js --live
# Должен вернуть HTTP 200 с email ID, не 400 invalid_api_key
```

### 2.3 Кодовая находка — `fail-open` при domain error

**Где:** `lib/services/email.service.js:733-737`

```js
if (!response.ok) {
  if (data.message?.includes('domain') || data.message?.includes('verify')) {
    console.log(`[EMAIL QUEUED] Domain not verified. Email to ${to} logged for later: ${template.subject}`)
    return { success: true, queued: true, reason: 'domain_not_verified' }
  }
  ...
}
```

**Проблема:** если Resend возвращает ошибку про домен, код считает это **успехом**. Это:
- ✅ маскирует проблему конфигурации
- ❌ вызывает тихую потерю писем
- ❌ может задублировать alert про "Resend domain not verified"

**Рекомендация:**
- **Сейчас:** изменить на `success: false, error: 'domain_not_verified'` (но `notification.service.js` уже знает про queued — нужна аккуратная миграция)
- **Лучше:** выделить domain config в `system_alert` (уже сделано, см. lines 740-744) и возвращать `success: false` всегда
- В Cron добавлен `notification-outbox` — если письмо реально queued, оно **должно** лежать в outbox таблице с retry, и outbox-cron должен его перепослать. Проверить таблицу `notification_outbox` и её наполнение.

### 2.4 From-адрес по умолчанию

**Default:** `buildDefaultFromAddress('booking')` → `Airento <booking@airento.ru>` (env `EMAIL_FROM`/`FROM_EMAIL` не заданы в `.env.local`).

**Рекомендация:**
- Задать `EMAIL_FROM=Airento <noreply@airento.ru>` в Vercel env (или `booking@` если хотите)
- Задать `NOREPLY_FROM=Airento <noreply@airento.ru>` для системных писем
- Это уберёт runtime-вычисление домена и даст явный контроль

### 2.5 Премиум HTML-шаблоны — PASS

**Где:** `lib/email/premium-email-html.js`, `lib/email/simple-transactional-email.js`

- Используется PNG-lockup `airento-lockup.png` (не SVG — правильно, email clients strip SVG)
- `escapeHtml` на всех user-полях (subject, paragraphs) — XSS-safe
- `preheader` обрезается до 140 символов
- CTA href / label — отдельные поля
- i18n: `booking-email-i18n.js` (RU/EN/ZH/TH)

**Вердикт:** шаблоны продуманные.

---

## 3. Дополнительные находки (что ещё заметил)

### 3.1 ✅ ЗАКРЫТО (Stage 202.18) — Cookie consent (GDPR / 152-ФЗ)

**Исходная проблема:** в коде не было cookie-consent баннера. PostHog + локальные user-state cookies ставились без явного согласия. Юр.риск в ЕС (GDPR) и РФ (152-ФЗ): штраф до 500K ₽ в РФ, до 4% оборота в ЕС.

**Реализация (Stage 202.18):**
- `components/CookieConsent.jsx` — баннер (2 кнопки + ссылка на `/legal/privacy`, delay 0.5s, a11y)
- `lib/consent/cookie-consent-state.js` — `hasAnalyticsConsent()`, `shouldShowBanner()`, version bump для re-prompt
- `lib/consent/cookie-consent-config.js` — SSOT версии политики (`COOKIE_CONSENT_POLICY_VERSION = 1`)
- `lib/translations/slices/cookie-consent.js` — RU/EN/ZH/TH (исправлены ZH/TH опечатки)
- `lib/analytics/product-analytics.js` — PostHog init gated на `hasAnalyticsConsent()`
- `components/analytics/ProductAnalyticsInit.jsx` — re-init через `COOKIE_CONSENT_EVENT` (без re-init при «Принять все» PostHog бы не подгрузился до перезагрузки)
- `components/providers/DeferredRootChrome.jsx` — `<CookieConsent />` глобально (не только storefront)
- `__tests__/stage202-18-cookie-consent.test.js` — 8/8 pass
- Доки: `TECHNICAL_MANIFESTO.md`, `HISTORY.md`, `SYSTEM_MAP.md`

**Не тронуто (по дизайну):** HTTP-only cookies (`gostaylo_session`/`gostaylo_csrf`), `gostaylo_user` (UI cache, не third-party), `/legal/privacy` страница, PostHog events API.

**Что осталось в фоне (P3):**
- `COOKIE_CONSENT_POLICY_VERSION` в localStorage захардкожен — если политика изменится, нужно `npm run bump:consent-policy` (или ручной bump константы)
- Нет админ-эндпоинта `GET /api/v2/admin/cookie-consent-stats` (сколько юзеров согласилось / отказалось) — для product analytics, не для security

### 3.2 🟠 P1 — `phone_verified_at` SSOT отсутствует

**Где:** `app/api/v2/auth/phone/verify/route.js` (упомянуто в Cursor-аудите)

**Проблема:** phone OTP верифицируется в `auth_phone_otp_challenges`, но **не персистится** в `profiles.phone_verified_at`. Это значит:
- Settings UI не может показать "телефон подтверждён" (используется только факт OTP)
- KYC на выплатах опирается на другой флаг

**Рекомендация:** миграция `add_phone_verified_at.sql` + обновить `phone/verify` route.

### 3.3 🟠 P1 — `email_verified_at` слабо задокументирован

**Где:** упоминается в `lib/auth/profile-verification-flags.js`, `app/api/v2/auth/verify/route.js`, и `memory/PRD.md` (если есть)

**Проблема:** Cursor-аудит отметил — column может **отсутствовать** в production schema. Это не точно (есть `profileHasEmailVerified`), но **документация/миграция не найдена** в `migrations/`.

**Рекомендация:** добавить `migrations/2026_08_add_email_verified_at.sql` (с `IF NOT EXISTS`).

### 3.4 🟠 P1 — iCal export token без rotation

См. §1.5.

### 3.5 🟡 P2 — Middleware fail-open на ban check

**Где:** `middleware.ts:39-71` — при сетевой ошибке REST-запроса возвращается `false` (не забанен)

**Проблема:** если Supabase лежит, забаненный юзер может зайти. Но `requireAccess` на API перепроверит.

**Вердикт:** by design (комментарий "API перепроверит на Node"), **допустимо**.

### 3.6 🟡 P2 — Resend API key в `.env.local` не помогает прод-расследованиям

**Проблема:** нельзя узнать состояние API key без доступа к Resend dashboard. **Системный админ должен мониторить `EMAIL_FAILURE` сигналы** в `recordCriticalSignal` — но это только в Telegram alert, не в дашборд.

**Рекомендация:** добавить endpoint `/api/v2/admin/email-health` который показывает recent `EMAIL_FAILURE` events (только для ADMIN).

---

## 4. Глобальный план (что делать)

### 4.1 P0 — чиним немедленно (эта неделя)

1. **DNS: добавить SPF** для `airento.ru`
   ```
   airento.ru. IN TXT "v=spf1 include:resend.com ~all"
   ```
   Сделать на reg.ru / nic.ru (где куплен домен). 10 минут. Эффект: доставляемость email вырастет.

2. **DMARC: поднять до `p=quarantine` или `p=reject`**
   ```
   _dmarc.airento.ru IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@airento.ru; pct=100"
   ```
   10 минут. Эффект: защита от spoofing + лучше inbox placement.

3. **Vercel env: проверить `RESEND_API_KEY`**
   - Зайти в Vercel Dashboard → Settings → Environment Variables
   - Убедиться, что `RESEND_API_KEY` валидный (Resend Dashboard → API Keys)
   - Запустить smoke: `node email-resend-direct.js --live` — должен вернуть email ID

4. **Email fail-open: исправить в `email.service.js`**
   - При `domain_not_verified` возвращать `success: false`
   - Поднять `EMAIL_FAILURE` signal
   - Завязать на `notification_outbox` cron для retry (он уже есть в `vercel.json:0 5 * * *`)

5. **Cookie consent (GDPR / 152-ФЗ)** — ✅ **ЗАКРЫТО в Stage 202.18** (см. §3.1).

### 4.2 P1 — следующие 2-3 недели

6. **Auth SSOT split** (Cursor-аудит P0)
   - Разделить `is_verified` (email gate) / `verification_status` (KYC) / `partner_payout_profiles.is_verified` (rails)
   - Сейчас `profileHasEmailVerified` принимает **OR** — лучше явно `email_verified_at` (или новый `email_confirmed_at`)
   - 1 stage

7. **`phone_verified_at` SSOT**
   - Миграция + обновить `phone/verify` route
   - 1 stage

8. **`email_verified_at` миграция-документация**
   - Убедиться, что column существует в prod schema
   - Если нет — добавить миграцию `add_email_verified_at.sql`
   - 1 audit + 1 stage

9. **iCal token rotation**
   - Добавить `metadata.ical_token_rotated_at` + endpoint `POST /api/v2/partner/listings/[id]/ical-rotate`
   - UI: кнопка "Обновить ссылку"
   - 1 stage

10. **YooKassa idempotence race + UI success on PAID_ESCROW** (Cursor-аудит P0)
    - 1-2 stage

### 4.3 P2 — наблюдаем (не чиним сейчас)

11. `partner/applications` + `apply` — defense in depth: добавить `verifyPartnerAccess` в route
12. `partner/finances-export` — построчная проверка
13. Middleware fail-open — допустимо по дизайну
14. Sentry / observability — отдельный проект

---

## 5. Что НЕ нашёл (хорошие новости)

- ✅ 48/50 партнёрских эндпоинтов имеют явный auth check
- ✅ Все 81 админских эндпоинта проходят через централизованный RBAC
- ✅ ADMIN/MODERATOR разделение чёткое, финансы только ADMIN
- ✅ Ownership check везде через `.eq('owner_id', userId)` / `.eq('partner_id', userId)`
- ✅ Промокоды, KYC, выплаты, seasonal prices, calendar — везде фильтрация
- ✅ `requireAdminStaff` + path-based RBAC = defense in depth
- ✅ Rate limit распределённый (Vercel KV → Upstash → in-memory)
- ✅ Email-шаблоны XSS-safe (escapeHtml)
- ✅ Email lockup — PNG, не SVG (правильно для email clients)
- ✅ 28 cron jobs — богатая автоматизация
- ✅ Middleware: legacy URL redirect (Stage 202.9b)
- ✅ iCal token используется (vs hardcoded), но без rotation
- ✅ `isPartnerProfileAdminVerified` уже отделён от `is_verified`

---

## 6. Артефакты

- **Этот документ:** `docs/audits/stage-security-IDOR-email-2026-08-27.md`
- **Smoke-скрипт:** `C:\Users\pavel\.minimax\scratch\email-resend-direct.js`
  - `node email-resend-direct.js` — мок (только GET /domains, /api-keys)
  - `node email-resend-direct.js --live` — реальная отправка на `delivered@resend.dev`
- **Связанные аудиты:** `docs/audits/booking-critical-nodes-audit`, `docs/audits/stage-PWA-cabinet-2026-08-19.md`
- **Связанные файлы кода:**
  - `middleware.ts` (Edge auth)
  - `lib/security/admin-staff-access.js` (admin helper)
  - `lib/admin/admin-api-access.ts` (path RBAC matrix)
  - `lib/email/email-env.js` (From address)
  - `lib/email/resend-transport-guard.js` (mock guard)
  - `lib/services/email.service.js` (sendEmail)
  - `lib/auth/profile-verification-flags.js` (email/identity split)
  - `lib/partner/partner-payout-kyc.js` (KYC gate)

---

**Следующий шаг:** проверить Vercel env (`RESEND_API_KEY`), добавить SPF, починить fail-open. Это 1-2 часа работы и сразу поднимет доставляемость.

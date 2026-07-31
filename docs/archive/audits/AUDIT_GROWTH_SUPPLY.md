# Аудит готовности интерфейсов роста: Creator Pack + iCal Гостеприимство

> **Версия:** 1.2 · **Дата:** 2026-07-18 · **Роль:** Chief Growth Officer (code-truth)  
> **Продукт:** Airento (`getSiteDisplayName()` / env)  
> **Контекст:** referral reinvestment default **45%** чистой маржи; guest CRO (Stage 190–191) закрыт.  
> **Скоуп:** кабинеты масштабирования supply — амбассадоры (`/profile/referral`) и партнёры (`/partner/*`, iCal).  
> **Rev 1.1:** Vercel Hobby (cron ≤1/day в `vercel.json`) + prod poke через cron-job.org.  
> **Rev 1.2:** Stage **192.0** закрыл Creator Pack P0 (C-P0-1…3) — presentation-only.
> **Метод:** обзор UI + API + cron по репозиторию (без изменений продуктовой логики выплат/escrow).  
> **Связанные доки:** `docs/BUSINESS_LOGIC_REFERRAL.md`, `docs/REFERRAL_USER_GUIDE.md`, `docs/CRON_SCHEDULING.md`, `docs/AUDIT_CONVERSION_CRO.md`.

### Ops: расписание cron (не путать с UX-дефолтом `auto_sync`)

| Слой | Правило |
|------|---------|
| **Vercel Hobby (текущий тариф)** | В `vercel.json` — **не чаще 1 раза в 24 часа** на выражение. Более частые schedule в `vercel.json` **ломают деплой**. |
| **Прод-частота (iCal и др.)** | Внешний **cron-job.org** дергает `/api/cron/*` (iCal Sync ~**каждые 30 мин**, confirmed green на панели). |
| **Запрет для агентов/PR** | **Не** менять `vercel.json` crons на `*/30`, hourly и т.п. «ради iCal» — только daily fallback. Частоту править только на cron-job.org / в доке `CRON_SCHEDULING.md`. |

Скрин/состояние панели (2026-07-18): job **Gostaylo iCal Sync** → `airento.ru/api/cron/ical-sync` — success, next +30m. Отдельно (вне скоупа growth UX, но видно на панели): HTTP error у `checkin-reminder`, `owner-marketing-digest`, `promote-ready-for-payout`.

---

## 0. Executive summary

| Канал роста | Зрелость бэкенда | Зрелость creator/host UX | Главный разрыв |
|-------------|------------------|--------------------------|----------------|
| **Creator Pack** (амбассадор) | Высокая (ledger, hold 14d, QR/PDF/Stories, fraud) | Средняя: инструмент есть, **язык — финтех-ops** | Нет UTM-конструктора каналов; жаргон убивает share-intent |
| **iCal Гостеприимство** (хост) | Высокая (import/export, atomic replace; **prod poke ~30m via cron-job.org**, Vercel = daily only) | Средняя: UI двухсторонний, **auto_sync OFF по умолчанию** | Риск овербукинга при «вставил ссылку и забыл»; publish ≠ 3 минуты |

**Вывод:** движки сильнее, чем витрины для блогера и Оксаны. Рост упирается не в отсутствие фич, а в **ясность оффера** и **безопасные дефолты синхронизации**.

---

## 1. Карта поверхностей (SSOT)

### 1.1 Creator / Ambassador

```
/profile/referral          ReferralProfilePage (+ tabs Link / Earnings / Team / History / Settings)
/profile/wallet            вывод + «водопад» + история выплат
/partner/referrals         redirect → /profile/referral
/u/[id]                    публичный лендинг амбассадора
/go/[vanity]               vanity + UTM passthrough
GET /api/v2/referral/me    код, ссылка, статистика
GET /api/v2/referral/track UTM ingest + cookie gostaylo_ref
```

Ключевые UI: `components/referral/ReferralProfilePage.jsx`, `ReferralProfileTabLink.jsx`, `ReferralMarketingKit.jsx`, `ReferralBalanceBreakdown.jsx`, `ReferralWithdrawalWaterfall.jsx`, `ReferralEarningsEstimator.jsx`.  
i18n: `lib/translations/slices/profile-app-referral.js`.

### 1.2 Partner / iCal

```
/partner/listings/new|edit   wizard 5 шагов + StepCalendarSection (edit)
/partner/calendar            master calendar + ?onboarding=true после publish
CalendarSyncManager          Import / Export / auto_sync / Sync
POST /api/ical/sync          parse | sync | sync-partner-all
POST /api/cron/ical-sync     только listings с auto_sync=true + interval
GET  /api/v2/listings/[id]/ical   публичный export .ics
```

Ключевые файлы: `components/calendar-sync-manager.jsx`, `lib/services/ical-calendar-blocks-sync.js`, `app/api/cron/ical-sync/route.js`, `lib/partner/listing-quality-gates.js`, `app/(partner)/partner/listings/new/`.

---

## 2. Диагноз Creator Pack

### 2.1 Простота оффера — **частично провал ясности**

Кабинет богатый (табы, estimator, уровни, team), но **copy говорит языком admin/fintech**, а не блогера.

Примеры user-facing строк (`profile-app-referral.js`):

| Ключ | Проблема |
|------|----------|
| `stage91_estimatorDisclaimer` | «**(reinvest + split)**… **маржи**… **safety-lock**» — англо-финтех в RU UI |
| `stage1322_waterfallTitle` | «**Водопад вывода**» / Withdrawal waterfall |
| `stage1322_waterfallGrossLabel` / `NetLabel` | **Gross / Net / mid-курс / спред 0%** |
| `stage74_l1l2Hint` | «**ledger_depth**» |
| `stage1321_walletReferralQueued` | статус **`withdrawable_referral`** в тексте для человека |
| `stage1321_walletAccrualRule1` | **`payout_to_internal_ratio`** |
| Settings hardcode (`ReferralProfileTabSettings.jsx`) | «**hold override**» без i18n |

Точной фразы «маржинальный waterfall» в кабинете нет — ближайший аналог **«Водопад вывода»** + reinvest/split/safety-lock. Для блогера это выглядит как бэк-офис банка, не как «поделись ссылкой — получи X%».

**Что мешает шарить:** страх «непонятно сколько получу» + ощущение сложности продукта → откладывает Copy Link / Stories.

### 2.2 UTM-конструктор — **отсутствует в UI**

| Слой | Статус |
|------|--------|
| Track API принимает `utm_source` / `utm_medium` / `utm_campaign` | ✅ `app/api/v2/referral/track/route.js`, `auth-referral-handler.js` |
| Attribution в БД | ✅ `lib/referral/attribution.service.js` |
| UI: выбрать канал TG / IG Reels / YouTube → получить ссылку с UTM | ❌ |
| Share в Marketing Kit (WA/TG/FB) | ✅ шарит **голую** landing/ref без UTM-штампа |

Блогер не может честно ответить «откуда пришли 12 регистраций с Reels vs YouTube» без ручного костыля в Notion.

### 2.3 Прозрачность баланса — **почти есть, формулировки слабые**

| Состояние | В коде / UI | Friction |
|-----------|-------------|----------|
| Доступно к выводу | `ReferralBalanceBreakdown` → withdrawable | Лейбл «на карту РФ», не «Доступно» как триада |
| В холде | `heldReferralBalanceThb` + unlock date; SSOT **`DEFAULT_REFERRAL_HOLD_DAYS = 14`** (`referral-hold.service.js`) | Число **«14 дней»** почти не говорится в UI — только дата/«период защиты» |
| Security hold | отдельная полоса 1–3 дня | Ок |
| Выплачено | баннер стадий + история (`ReferralWithdrawalStatusBanner`, wallet) | Не третья колонка рядом с Available/Hold на одной карточке |

Триада **Доступно / Холд 14 дней / Выплачено** как один визуальный блок — **не собрана**.

### 2.4 Creator Kit — **есть под другим именем**

Продуктового имени «Creator Pack» нет. Есть сильный **Marketing Kit**:

- QR (`ReferralProfileTabLink`, `ReferralMarketingKit`)
- PNG QR, PDF-визитка (`lib/referral/ambassador-card-pdf.js`)
- Stories 9:16 ×2, готовые тексты постов, WA/TG/FB/native share

**Нет:** брендированного ZIP (лого/баннеры/видео-шаблоны), Instagram/YouTube deep-share, per-channel UTM внутри кита.

### 2.5 Итог Creator: что мешает активно делиться

1. **Жаргон** на экране денег → недоверие к офферу.  
2. **Один линк без каналов** → нельзя оптимизировать контент.  
3. **Hold/Paid** размазаны** → «где мои деньги?» съедает support и мотивацию.  
4. Kit сильный по QR/Stories, но **не упакован как Creator Pack** и не закрывает UTM.

---

## 3. Диагноз Host iCal («Гостеприимство Оксаны»)

### 3.1 iCal: импорт / экспорт — **есть и понятен технически**

- **Import:** вставка URL Airbnb / Booking / VRBO / Google / Custom → `calendar_blocks` (`CalendarSyncManager`, `ical-calendar-blocks-sync.js`).  
- **Export:** токенизированный `.ics` для обратной подписки OTA (`/api/v2/listings/[id]/ical`, `ical-export-link`).  
- Education: `PartnerCalendarEducationCard.jsx`; post-publish → `/partner/calendar?onboarding=true`.  
- **Transport (байк/авто):** внешний iCal **скрыт** — только ручные busy-даты (осознанно).

Для Оксаны с виллой двухсторонний сценарий **реален**, но когнитивно тяжёлый: Export tab (вставить Airento в Airbnb) + Import tab (наоборот).

### 3.2 Автосинк vs ручная кнопка — **критичный дефолт**

| Факт | Где |
|------|-----|
| `auto_sync: false` по умолчанию | `calendar-sync-manager.jsx` (~68–69, 127–135) |
| `sync_interval_hours: 24` по умолчанию | там же |
| Endpoint `POST/GET /api/cron/ical-sync` берёт только listings с `auto_sync === true` + возраст `last_sync` ≥ interval | `app/api/cron/ical-sync` |
| **Кто дергает endpoint** | **cron-job.org ~каждые 30 мин** (prod); в `vercel.json` — **только daily** fallback на Hobby (`0 0 * * *`). Не учащать Vercel. | `docs/CRON_SCHEDULING.md`, панель cron-job.org |

**Важно разделить два «24 часа»:**

1. **Vercel Hobby** — лимит платформы на schedule в `vercel.json` (не трогать).  
2. **`sync_interval_hours: 24` у листинга** — продуктовый дефолт «как часто *этому* объекту можно синкаться», даже если cron-job.org стучится каждые 30 мин. Пока interval=24h, листинг обновляется ~раз в сутки после включения Auto.

**Риск Оксаны:** «Вставила ссылку Airbnb → думаю, синхронизируется» → job на cron-job.org может бегать, но **её listing пропускается**, пока `auto_sync` off → окно овербукинга. Ручной Sync всё ещё спасает.

Даже с Auto ON и interval 24h same-day бронь на Airbnb может на часы/сутки остаться свободной на Airento — это UX/metadata, не отсутствие cron-job.org.

### 3.3 Защита от накладок — **односторонняя**

| Сценарий | Защита |
|----------|--------|
| Гость бронирует на Airento после импорта busy с Airbnb | ✅ блоки в availability / atomic booking |
| `AWAITING_PAYMENT` занимает даты | ✅ status-sets |
| Empty OTA feed при живых блоках | ✅ `SUSPICIOUS_EMPTY_FEED` (не затирает) |
| Airbnb бронирует ночи, уже проданные на Airento | ⚠️ после следующего import видны overlapping blocks; **нет алертов/резолва** |
| Host без auto_sync | ❌ высокий риск double-book |

Маркетинговый «overbooking protection» = **блоки для новых броней Airento**, не hard guarantee против гонки OTA.

### 3.4 Скорость создания объявления — **не 3 минуты до publish**

Wizard: **5 шагов** (`LISTING_WIZARD_STEP_COUNT`). Publish gates (`listing-quality-gates.js`):

- ≥ **5** фото  
- описание ≥ **120** символов  
- район + координаты (stay/transport/…)  
- вертикальные поля (villa: bedrooms/bathrooms/guests; transport: year/seats)

**Есть:** draft (localStorage 7d + server `INACTIVE`/`is_draft`), Airbnb **content** import (`PartnerListingImportBlock`), mobile chrome визарда, iCal после publish.

**Нет:** «опубликовать минимум → донастроить позже» (MVP publish). Байк/машина/вилла с телефона упираются в тот же бар качества.

### 3.5 Итог Host: удобство vs безопасность

Система **достаточно сильна**, если Оксана включила Auto Sync и понимает двухсторонний setup. Дефолты и publish-gate делают «гостеприимство с телефона за 3 минуты» **нереалистичным** и оставляют дыру овербукинга при пассивном использовании.

---

## 4. План улучшений (P0 / P1)

Снайперские UI/UX-доработки. **Не трогать** escrow / capture / referral math engine без отдельного ADR — только presentation, defaults, copy, tooling.

### 4.1 Creator Pack — P0

| ID | Доработка | Файлы |
|----|-----------|-------|
| **C-P0-1** | ✅ Done 192.0 — plain copy; Gross/Net/reinvest removed | `profile-app-referral.js`, waterfall/estimator |
| **C-P0-2** | ✅ Done 192.0 — «Холд 14 дней» + hint | `ReferralBalanceBreakdown.jsx` |
| **C-P0-3** | ✅ Done 192.0 — UTM chips TG/IG/YT/VK | `ReferralProfileTabLink.jsx`, `ambassador-utm-link.js` |


### 4.2 Creator Pack — P1

| ID | Доработка | Файлы |
|----|-----------|-------|
| **C-P1-1** | Переименовать/упаковать UI как **Creator Pack** (eyebrow + checklist: ссылка → UTM → QR → Stories) | `ReferralMarketingKit.jsx`, `ReferralProfileTabLink.jsx`, i18n |
| **C-P1-2** | Мини-аналитика по каналам (клики/регистрации с группировкой utm_source) на Earnings/Team | API stats + `ReferralProfileTabEarnings.jsx` / новый chart |
| **C-P1-3** | Локализовать hardcode Settings («hold override») | `ReferralProfileTabSettings.jsx` |
| **C-P1-4** | Soften wallet «водопад» → «Расчёт выплаты на карту» без Gross/Net jargon | `ReferralWithdrawalWaterfall.jsx` + keys `stage1322_*` |

### 4.3 Host iCal — P0

| ID | Доработка | Файлы |
|----|-----------|-------|
| **H-P0-1** | При первом успешном add source: **включить `auto_sync: true`** (или modal «Включить автообновление?») и снизить **`sync_interval_hours`** до **1–6** (metadata листинга). **Не** менять частоту в `vercel.json` — частый poke уже на cron-job.org | `calendar-sync-manager.jsx`, persist metadata |
| **H-P0-2** | Onboarding checklist: «iCal защищает от накладок **только если Auto Sync ON**» + CTA Sync now | `PartnerCalendarEducationCard.jsx`, `partner-onboarding-status.js`, `/partner/calendar` onboarding |
| **H-P0-3** | Alert при import overlap с активной бронью Airento (баннер + TG/email partner) | `ical-calendar-blocks-sync.js` (detect only) + UI на `partner/calendar` / listing edit — **без auto-cancel** |

### 4.4 Host listing speed — P1

| ID | Доработка | Файлы |
|----|-----------|-------|
| **H-P1-1** | **Soft publish / «Витрина скоро»:** ACTIVE с badge Incomplete при 1–3 фото + короткий desc; жёсткие gates для Featured / TOP | `listing-quality-gates.js`, wizard validation, listing card badge |
| **H-P1-2** | Вынести iCal в явный шаг post-publish wizard (уже redirect есть — усилить copy + progress 1/2 import+export) | `post-publish-redirect.js`, `partner/calendar/page.js`, `StepCalendarSection.jsx` |
| **H-P1-3** | Мобильный «критический путь» 3 минуты: title + price + 3 photos + district → draft-live; остальное Later | `app/(partner)/partner/listings/new/*`, mobile chrome |
| **H-P1-4** | Transport: короткий path без map friction где политика позволяет; calendar education уже manual-only — не путать с villa iCal | `StepCalendarSection.jsx`, `PartnerCalendarEducationCard.jsx` |

---

## 5. Scorecard аудита

### Creator Pack

| Вопрос | Оценка | Комментарий |
|--------|--------|-------------|
| Понятен ли оффер блогеру? | ⚠️ 4/10 | Estimator есть; jargon доминирует |
| UTM-конструктор TG/IG/YT | ❌ 1/10 | Backend готов, UI нет |
| Доступно / Холд / Выплачено | ⚠️ 6/10 | Данные есть; триада и «14 дней» слабые |
| Creator Kit / QR | ✅ 8/10 | Marketing Kit сильный; нет имени Pack + UTM |

### Host iCal + onboarding

| Вопрос | Оценка | Комментарий |
|--------|--------|-------------|
| Простота import/export | ⚠️ 6/10 | UI полный; 2 шага OTA + education |
| Фоновый cron | ✅/⚠️ | Prod: cron-job.org ~30m → `/api/cron/ical-sync`; Vercel daily only (Hobby). Gap = **default `auto_sync` off** + interval 24h |
| Защита от овербукинга | ⚠️ 5/10 | Inbound OK; race + no overlap alert |
| Publish за ~3 мин с телефона | ❌ 3/10 | 5 фото + 120 + geo + specs |

---

## 6. Рекомендуемый порядок внедрения (2 спринта)

**Спринт A (рост ссылок):** C-P0-1 → C-P0-2 → C-P0-3 → C-P1-1.  
**Спринт B (supply safety):** H-P0-1 → H-P0-2 → H-P0-3 → H-P1-2; параллельно дизайн H-P1-1/H-P1-3.

Метрики успеха:

- Creator: % амбассадоров с ≥2 UTM-каналами; share rate Link tab; ticket rate «где деньги».  
- Host: % листингов housing с `auto_sync=true` через 24h после add source; count overlap alerts; time-to-first-publish p50 mobile.

---

## 7. Out of scope (явно)

- Изменение формулы referral 45% / split / hold engine.  
- Escrow, payment capture, partner payout batch.  
- Новые OTA API (только iCal feeds).  
- **Учащение cron в `vercel.json`** (Hobby: max 1/day) — запрещено; частые джобы только через cron-job.org / внешний scheduler.  

---

*Конец аудита 1.0 (rev: ops cron-job.org + Vercel Hobby). При реализации P0 — обновить `docs/TECHNICAL_MANIFESTO.md` и `docs/ARCHITECTURAL_PASSPORT.md` в том же PR.*

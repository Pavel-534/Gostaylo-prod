# Технический аудит: iCal + onboarding объявлений (Sprint B prep)

> **Версия:** 1.0 · **Дата:** 2026-07-22 · **Роль:** System Architect (read-only)  
> **Продукт:** Airento · **Код не менялся**  
> **Связано:** `docs/AUDIT_GROWTH_SUPPLY.md` (H-P0), `docs/CRON_SCHEDULING.md` (Vercel Hobby ≤1/day; частый poke — cron-job.org)

---

## 1. Карта файлов (SSOT)

| Зона | Путь |
|------|------|
| UI привязки iCal | `components/calendar-sync-manager.jsx` |
| Встраивание в edit wizard | `app/(partner)/partner/listings/new/components/StepCalendarSection.jsx` |
| Клиент API sync | `lib/api/ical-sync-client.js` → `POST /api/ical/sync` |
| Partner sync API | `app/api/ical/sync/route.js` |
| Cron worker | `app/api/cron/ical-sync/route.js` |
| Парсер + запись блоков | `lib/services/ical-calendar-blocks-sync.js` |
| Persist settings | `PATCH/PUT` `sync_settings` → `app/api/v2/partner/listings/[id]/route.js` (~270–271) |
| Quality gates publish | `lib/partner/listing-quality-gates.js` |
| Wizard step gates | `app/(partner)/partner/listings/new/hooks/listing-wizard-step-validation.js` |
| Save draft / publish | `app/(partner)/partner/listings/new/hooks/useListingSave.js` |
| Draft row before photos | `lib/partner/ensure-wizard-draft-listing.js` |
| Create schema (Zod) | `lib/validations/listing.js` (`createListingSchema`) |
| Create API | `app/api/v2/partner/listings/route.js` (POST), также draft через `POST /api/v2/listings` в `useListingSave` |

**Имени `PartnerCalendarSyncForm.jsx` нет** — канон UI: **`CalendarSyncManager`**.

---

## 2. Форма привязки iCal — дефолты и payload

### 2.1 Default state (фронт)

Файл: `components/calendar-sync-manager.jsx`

```66:71:components/calendar-sync-manager.jsx
  const [syncSettings, setSyncSettings] = useState({
    sources: [],
    auto_sync: false,
    sync_interval_hours: 24,
    last_sync: null,
  })
```

При загрузке листинга те же fallback’и:

```127:136:components/calendar-sync-manager.jsx
            auto_sync: listing.metadata.auto_sync || false,
            sync_interval_hours: listing.metadata.sync_interval_hours || 24,
        ...
          auto_sync: settings.auto_sync || false,
          sync_interval_hours: settings.sync_interval_hours || 24,
```

| Поле | Факт |
|------|------|
| **`auto_sync`** | **`false` по умолчанию** |
| Интервал | **`sync_interval_hours: 24`** — **не** `sync_interval_minutes` (такого поля в коде нет) |
| Источники | `sources: []` → после add: `{ id, url, platform, enabled, added_at, status, last_sync, events_count }` |

### 2.2 Куда уходят данные

1. **Настройки** (sources / auto_sync / interval / last_sync):

```168:171:components/calendar-sync-manager.jsx
  async function saveSyncSettings(newSettings, { silent = false } = {}) {
    ...
      const { ok } = await patchPartnerListing(listingId, { sync_settings: newSettings })
```

→ колонка **`listings.sync_settings`** (JSONB), через partner listing update (`body.sync_settings` → `updateData.sync_settings`, route ~270–271).

2. **Parse** (проверка URL без записи блоков): `postIcalSync({ action: 'parse', url })` → `/api/ical/sync`.

3. **Sync** (ручной): `postIcalSync({ action: 'sync', listingId, sources })` → пишет `calendar_blocks` через `syncIcalSourceToCalendarBlocks`.

4. **Toggle Auto Sync**: `handleToggleAutoSync` → сразу `saveSyncSettings({ ...syncSettings, auto_sync: checked })` — **не** включает auto при первом add source (после `handleAddSource` сохраняется только расширенный `sources`, `auto_sync` остаётся прежним `false`).

### 2.3 Cron-потребитель тех же полей

`app/api/cron/ical-sync/route.js` ~71–78:

- берёт listings с непустым `sync_settings`;
- **пропускает**, если `!settings.auto_sync`;
- интервал: `(settings.sync_interval_hours || 24) * 3600_000` vs `last_sync`.

**Важно:** частота **вызова** cron (~30 мин через cron-job.org) ≠ частота **синка листинга** (дефолт 24h metadata). Vercel `vercel.json` — только daily fallback (Hobby).

---

## 3. Overlap / конфликты с оплаченными бронями

### 3.1 Что делает бэкенд при sync

`lib/services/ical-calendar-blocks-sync.js` → `syncIcalSourceToCalendarBlocks`:

1. fetch + `parseIcalToOccupancyRanges`;
2. защита **`SUSPICIOUS_EMPTY_FEED`** (0 events, но есть active blocks → **skip replace**, alert);
3. `replaceCalendarBlocksForSource` — атомарная замена блоков **этого** `source` URL;
4. return: `{ status, events_count, error_message }` — **без массива conflicts / overlapping bookings**.

Поиск по сервису: **нет** чтения `bookings` / сравнения с `PAID_ESCROW` / `OCCUPYING_*` при import.

### 3.2 Что видит клиент после sync

`POST /api/ical/sync` action `sync` (~181):

```json
{ "success": true, "listingId", "results", "eventsProcessed" }
```

Нет поля `conflicts`. UI тост «Синхронизировано: N» — без баннера накладок.

### 3.3 Есть ли UI «готов отобразить conflicts»?

- `AvailabilityCalendar` принимает `syncErrors` и умеет рендерить список (`components/availability-calendar.jsx` ~21, ~123+).
- В wizard: **`syncErrors={[]}` захардкожен** (`StepCalendarSection.jsx` ~30) — **не подключён** к результату iCal sync.

Конфликты capacity при **ручных** блоках/бронях партнёра идут через другие API (`calendar/block`, `manual-booking`) с `conflicts` — это **не** путь iCal import.

### 3.4 Вердикт overlap

| Вопрос | Ответ |
|--------|--------|
| Бэкенд возвращает конфликты Airbnb ∩ оплаченные брони? | **Нет** |
| UI компонент под conflicts iCal? | Слот `syncErrors` есть, **не wired** |
| Защита inbound (гость → Airento) | Да, через `calendar_blocks` + availability RPC (отдельный путь) |

---

## 4. Валидация публикации и DRAFT

### 4.1 Статус «DRAFT» в enum

Отдельного enum-значения **`DRAFT` нет**. Черновик = **`status: 'INACTIVE'`** + **`metadata.is_draft: true`** (и часто `available: false`).

### 4.2 Фронт: обязательные поля по шагам

`listing-wizard-step-validation.js` → `computeWizardCanProceed`:

| Step | Условие |
|------|---------|
| 1 | service type, categoryId, title ≥ **3**, description ≥ **120**, profile metadata |
| 2 | district + geo (если профиль требует координаты) |
| 3 | images ≥ **5** |
| 4 | basePrice > 0 |
| 5 | всё выше |

Константы: `LISTING_QUALITY_MIN_*` в `listing-quality-gates.js` (photos **5**, description **120**, title **3**).  
Publish metadata по профилю: stay → bedrooms/bathrooms/max_guests; transport → vehicle_year/seats; …

### 4.3 Бэкенд: когда срабатывает quality gate

`app/api/v2/partner/listings/[id]/route.js` ~344–380:

- gate **только** при `status` → **`PENDING` или `ACTIVE`** (publish attempt);
- **не** при сохранении `INACTIVE` / правке без смены в PENDING/ACTIVE;
- ответ 400 + `code: LISTING_QUALITY_GATE` + `errors[]`.

`POST /api/v2/partner/listings` (`createListingSchema` в `lib/validations/listing.js` ~15–32): create **без** `validateListingPublishQuality`. Zod: title min 3; description/district/geo/images **optional**; `basePriceThb` **обязателен и > 0** (не «нулевая» цена на create).

### 4.4 Можно ли сохранить без фото и geo?

| Путь | Результат |
|------|-----------|
| **localStorage** draft (`wizard-draft-storage.js`, 7 дней) | Да, без сервера |
| **`ensureWizardDraftListing`** | Нужен `categoryId`; images `[]`; lat/lng могут быть null; `metadata.is_draft: true` → POST partner listings; **заглушка цены** `Math.max(100, …)` (Zod `listingBasePriceSchema` требует `positive`) |
| **`saveDraft` в wizard** | `status: 'INACTIVE'`, `is_draft: true`; price может уйти как `0` на update-путях; **без** publish gate |
| **Publish / PENDING** | Жёсткий gate: 5 фото, 120 desc, geo (для stay/transport/…), specs |

**Вердикт DRAFT:** архитектура **позволяет** серверный черновик без фото и без geo. Quality gate **не** применяется к create/draft. Жёсткая ошибка — **только на publish (PENDING/ACTIVE)**. Create Zod всё же требует `partnerId`, `categoryId`, title ≥ 3 и **положительную** `basePriceThb` (черновик для upload подставляет ≥ 100 THB как placeholder, не «пустой объект»).

---

## 5. Технический вердикт: `auto_sync = true`

| Вопрос | Вердикт |
|--------|---------|
| Безопасно ли **переключить дефолт UI** на `true`? | **Да, с оговорками** — это metadata + cron filter; не меняет escrow/payment |
| Что сломается? | Чуть больше нагрузки на cron/OTA fetch; риск ложных empty feeds уже смягчён `SUSPICIOUS_EMPTY_FEED` |
| Достаточно ли одного `true`? | **Нет** для same-day защиты: при `sync_interval_hours: 24` листинг синкается ~раз в сутки даже если cron-job.org стучится каждые 30 мин |
| Нужен ли overlap-alert? | Для Sprint B **рекомендуется отдельно** (сейчас нет) — иначе auto_sync снижает, но не закрывает race OTA↔Airento |

Рекомендуемая безопасная связка дефолтов (для будущего PR, не сейчас):

1. При **первом успешном add source**: `auto_sync: true` + `sync_interval_hours: 1` или `6` (не трогать `vercel.json`).  
2. Либо modal «Включить автообновление?» с явной рекомендацией.  
3. Не включать auto глобально на все старые listings без миграции/comms.

---

## 6. Безопасный пошаговый план изменений (ничего не ломает)

### Phase B0 — наблюдаемость (0 риск)

1. Метрика/админ: % housing listings с `sources.length > 0` и `auto_sync === true`.  
2. Лог при sync: count nights imported (уже есть `eventsProcessed`).

### Phase B1 — дефолт auto_sync (низкий риск, presentation + metadata)

1. В `CalendarSyncManager.handleAddSource`: после успешного parse сохранять  
   `{ ...newSettings, auto_sync: true, sync_interval_hours: Math.min(existing, 6) }`  
   **или** toast + confirm.  
2. Не менять cron route / vercel.json.  
3. E2E: add source → reload → `auto_sync` true в `sync_settings`.  
4. Feature flag env optional (`ICAL_DEFAULT_AUTO_SYNC=1`) для rollback.

### Phase B2 — interval UX (низкий риск)

1. UI select «Обновлять каждые: 1 / 6 / 12 / 24 ч» (уже хранится hours).  
2. Подпись: «Фоновая проверка платформы каждые ~30 мин; ваш интервал — как часто обновлять *этот* объект».

### Phase B3 — overlap detect (средний риск, только detect)

1. В `syncIcalSourceToCalendarBlocks` **после** parse ranges: query occupying bookings overlapping ranges; return `conflicts: [{ bookingId, start, end }]` **без** auto-cancel.  
2. Пробросить в `/api/ical/sync` response.  
3. Прокинуть в `AvailabilityCalendar` через `syncErrors` / новый banner.  
4. Feature flag; сначала admin-only / soft toast.

### Phase B4 — soft publish (отдельный ADR, выше риск)

1. Не ослаблять gate «втихую».  
2. Новый статус/бейдж «Incomplete» **или** ACTIVE + `metadata.publish_incomplete` + скрытие из Featured.  
3. SSOT остаётся `listing-quality-gates.js` + partner PUT.

### Запреты

- Не ставить в `vercel.json` cron чаще 1/24h (Hobby).  
- Не менять financial/escrow в этом спринте.  
- Не удалять блоки при empty feed (уже защищено).

---

## 7. Резюме для Sprint B

1. **Дефолты:** `auto_sync: false`, `sync_interval_hours: 24` в `calendar-sync-manager.jsx`; persist → `listings.sync_settings`.  
2. **Overlap iCal↔bookings:** не детектится, UI слот пустой.  
3. **DRAFT:** `INACTIVE` + `is_draft`; publish gates только на PENDING/ACTIVE — черновик без 5 фото возможен.  
4. **Безопасный первый PR:** auto_sync on first source + shorter interval + copy; overlap — вторым PR с detect-only.

---

*Конец аудита 1.0. Реализация — только после явного тикета Sprint B.*

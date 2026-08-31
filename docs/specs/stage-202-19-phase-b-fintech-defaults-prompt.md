# Stage 202.19 (Phase B) — FinTech defaults & write-path — Промт для Cursor

**Зачем:** 31.08.2026 в live FannRent нашли учётный drift — `referral_reinvestment_percent = 65` и `acquiring_fee_percent = 0` (вместо канона 45 и 4.3). Причина — fallback `?? 0` в Marketing UI/API. **Phase A (операционная) уже сделана:** live приведены к канону, audit log написан. **Phase B (код) закрепляет** канон на уровне кода, чтобы drift не повторился.

**Связанные документы:**
- `docs/audits/stage-referral-economics-2026-08-29.md` (Cursor-аудит: что было / что стало)
- `docs/audits/stage-security-IDOR-email-2026-08-27.md` (P0/Cookie consent — закрыт Stage 202.18)
- `ARCHITECTURAL_DECISIONS.md` (ADR-131, 131A, 300+)
- `lib/config/fintech-config-defaults.js` (SSOT defaults)
- `lib/admin/settings-handlers/marketing-settings.js` (источник бага `?? 0`)

**Скоуп:** код (3-5 пунктов), один PR, без миграций, без изменения live данных.

---

## Что строим

1. **Defaults в Marketing UI/API**: fallback acquiring = **4.3**, reinvestment = **45** (не 0)
2. **Убрать дублирование**: Marketing save НЕ должен трогать `referral_reinvestment_percent` / `acquiring_fee_percent` (только FinTech panel)
3. **Admin banner в FinTech**: "Live ≠ code defaults" если значения расходятся; подсказка как выключить Owner mode
4. **Post-cutover migration script** (B6 из Cursor-аудита): strip fintech keys from `general` WHERE still present
5. **Audit guardrail**: при save в FinTech запретить `acquiring=0` если ambassador waterfall enabled

---

## Не делать (явно)

- ❌ Не трогать `lib/services/finance/fintech-waterfall.js` — SSOT waterfall
- ❌ Не трогать `lib/services/marketing/referral-payout.service.js` — SSOT split
- ❌ Не менять cap (1M остаётся), split (42/10/5/43 остаётся), L3 flag (true остаётся)
- ❌ Не менять схему БД (только defaults + UI + write-path)
- ❌ Не удалять `general` колонки (только stop writing в них)
- ❌ Не вводить новые типы `referral_type` (только Marketing cleanup)
- ❌ Не делать пресеты "Launch mode" (отдельный Stage, не сейчас)

---

## Архитектура

### Изменения в 4 файлах

```
lib/admin/settings-handlers/marketing-settings.js     # B1 + B3: fallback 4.3/45, drop fintech keys from save
components/admin/system/SystemSettingsMarketing.jsx   # B1: UI fallback 4.3/45, hide fintech keys
components/admin/finances/FinTechAmbassadorSettingsPanel.jsx  # B3 + B4 + B5: Owner mode hint, banner, guardrail
lib/config/fintech-config-defaults.js                  # cap default 1_000_000 (был 250k)
```

### Новые файлы

```
migrations/2026_08_31_strip_fintech_keys_from_general.sql  # B6: одноразовая гигиена
lib/admin/settings/__tests__/stage202-19-phase-b.test.js   # unit-тесты
```

### НЕ трогаем

- `lib/services/finance/fintech-waterfall.js` (SSOT waterfall)
- `lib/services/marketing/referral-payout.service.js` (SSOT split)
- `lib/services/marketing/referral-public-calculator.service.js` (SSOT formula)
- `lib/services/admin/admin-audit.js` (audit уже пишется)
- Live БД (Phase A уже привела значения к канону)

---

## Требования

### 1. `lib/admin/settings-handlers/marketing-settings.js`

**Текущая проблема (по Cursor-аудиту):** fallback `?? 0` для acquiring и `?? 65` для reinvestment (артефакт старой эры).

**Исправления:**

```js
// Было:
const acquiring = asNumber(input?.acquiring_fee_percent, 0)
const reinvest = asNumber(input?.referral_reinvestment_percent, 65)

// Стало:
const acquiring = asNumber(input?.acquiring_fee_percent, 4.3)  // ADR-131 SSOT
const reinvest = asNumber(input?.referral_reinvestment_percent, 45)  // ADR-131 SSOT
```

**Также (B3 — убрать дублирование):**

Marketing save НЕ должен сохранять `acquiring_fee_percent` / `referral_reinvestment_percent` в `system_settings.general`. Эти поля — **только для FinTech panel**.

```js
// В save handler — strip fintech keys перед persist в general
const stripFintechKeys = (obj) => {
  if (!obj || typeof obj !== 'object') return obj
  const copy = { ...obj }
  delete copy.acquiring_fee_percent
  delete copy.referral_reinvestment_percent
  // ... другие fintech-ключи (проверь по `fintech-config-defaults.js` какие именно)
  return copy
}
const cleanedBody = stripFintechKeys(body)
```

**Guardrail:** если в Marketing save **всё ещё приходит** `acquiring_fee_percent` или `referral_reinvestment_percent` — log warning в audit, **не падать**.

### 2. `components/admin/system/SystemSettingsMarketing.jsx`

**Текущая проблема:** `useState(0)` для acquiring, fallback `?? 0` в load.

**Исправления:**

```jsx
// Было:
const [acquiring, setAcquiring] = useState(0)

// Стало:
const [acquiring, setAcquiring] = useState(4.3)  // ADR-131 default
```

**Также:** UI должен **показывать подсказку** для пользователя:

```jsx
<Hint>
  Эквайринг и доля в рефералку настраиваются только в{' '}
  <a href="/admin/settings/finances">FinTech panel</a>{' '}
  (раздел «Ambassador 3.0»). Здесь эти поля не редактируются.
</Hint>
```

**Скрыть input'ы** для `acquiring_fee_percent` и `referral_reinvestment_percent` (только показ read-only с пометкой "managed by FinTech").

### 3. `components/admin/finances/FinTechAmbassadorSettingsPanel.jsx`

**Текущая проблема:** поля disabled без объяснения, нет подсказки про Owner mode, нет banner про рассинхрон.

**Добавления:**

**(B4) Подсказка про Owner mode** (вверху panel, если panel в Owner mode):

```jsx
{ownerMode && (
  <Alert variant="warning">
    <strong>Owner mode ON</strong> — поля только для просмотра. 
    Чтобы редактировать, выключите Owner mode в правом верхнем углу панели FinTech.
  </Alert>
)}
```

**(B4) Banner "Live ≠ code defaults":**

Сравнить `system_fintech_settings` (live) с `fintech-config-defaults.js` (code) по 4 ключевым полям: `referral_reinvestment_percent`, `acquiring_fee_percent`, `referral_monthly_program_cap_thb`, `ambassador_guest_l3_enabled`. Если хотя бы одно расходится — показать banner:

```jsx
{liveDiffersFromCode && (
  <Alert variant="info">
    <strong>Live ≠ code defaults</strong><br />
    <ul>
      {Object.entries(diff).map(([k, {live, code}]) => (
        <li key={k}>{k}: live = {live}, code = {code}</li>
      ))}
    </ul>
    <small>После синхронизации обновите <code>lib/config/fintech-config-defaults.js</code> или откатите live через эту панель.</small>
  </Alert>
)}
```

**(B5) Guardrail при save:**

```jsx
const handleSave = async (values) => {
  if (values.acquiring_fee_percent === 0 && ambassadorWaterfallEnabled) {
    if (!confirm('Acquiring 0% раздувает net в 2.3 раза. Вы уверены? Это разово для теста?')) {
      return
    }
  }
  if (values.referral_reinvestment_percent > 90) {
    if (!confirm('Pool >90% net оставит платформе <10%. Продолжить?')) {
      return
    }
  }
  // ... save
}
```

**Также (B4 — Owner mode toggle):** если `ownerMode=true` и user попытался нажать "Сохранить" — показать toast "Включён Owner mode, выключите для редактирования".

### 4. `lib/config/fintech-config-defaults.js`

**Текущая проблема:** cap default = **250 000**, но в live (после Phase A) — **1 000 000**.

**Исправление:**

```js
// Было:
export const REFERRAL_MONTHLY_PROGRAM_CAP_DEFAULT_THB = 250_000

// Стало (после owner sign-off на cutover 1M):
export const REFERRAL_MONTHLY_PROGRAM_CAP_DEFAULT_THB = 1_000_000
```

**Комментарий рядом** (как SSOT-traceability):

```js
/**
 * Program cap (sum of all guest_booking referral_ledger.amount_thb per UTC month, deferred if exceeded).
 * Defaults to 1M THB (post-cutover ADR-131A, applied 19.08.2026).
 * If new install runs this migration, cap will be 1M; older installs may have 250k — sync via FinTech panel.
 */
```

### 5. `migrations/2026_08_31_strip_fintech_keys_from_general.sql` (одноразовая гигиена)

```sql
-- Migration: strip fintech keys from system_settings.general
-- Date: 2026-08-31
-- Reason: prevent Marketing UI from accidentally reverting FinTech values

-- Step 1: identify rows with fintech keys in general
-- (do a dry-run SELECT first; if rows exist, log + UPDATE)
DO $$
DECLARE
  affected_count INT;
BEGIN
  UPDATE system_settings
  SET value = value - ARRAY['acquiring_fee_percent', 'referral_reinvestment_percent']
  WHERE key = 'general'
    AND jsonb_typeof(value) = 'object'
    AND (value ? 'acquiring_fee_percent' OR value ? 'referral_reinvestment_percent');

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Stripped fintech keys from % general settings row(s)', affected_count;
END $$;
```

**Перед запуском:** SHOW rows + audit. После — verify что `system_fintech_settings` (live) не задета.

### 6. Unit-тесты `lib/admin/settings/__tests__/stage202-19-phase-b.test.js`

Минимум 6 тестов:

1. `stripFintechKeys` удаляет `acquiring_fee_percent` и `referral_reinvestment_percent` из объекта
2. Marketing save с fintech keys в body → cleaned body, audit warning в лог
3. Marketing save **без** fintech keys → проходит нормально (no regression)
4. FinTech panel `handleSave` с `acquiring=0` + `ambassador_3_waterfall_enabled=true` → confirm dialog
5. Cap default = 1_000_000 (тест на `fintech-config-defaults.js`)
6. `liveDiffersFromCode` правильно сравнивает 4 ключевых поля

---

## SSOT — не трогать

- `fintech-waterfall.js` — SSOT waterfall (acquiring/USN/VAT calculation)
- `referral-payout.service.js` — SSOT split (L1/L2/L3/cashback)
- `referral-public-calculator.service.js` — SSOT formula
- `referral-program-cap.service.js` — SSOT cap enforcement
- `system_fintech_settings` (live DB) — Phase A уже привела к канону
- `fintech_snapshot` (в `bookings.metadata`) — SSOT для исторических броней
- ADR-131, ADR-131A, ADR-300 (финансовая архитектура 3.0) — не пересматриваем

---

## Тесты (обязательно)

- 6 unit-тестов (см. выше)
- 1 e2e (опционально): Marketing save → verify `general` НЕ содержит fintech keys
- Manual smoke: загрузить `/admin/system` → нет input'ов для acquiring/reinvestment, есть hint с ссылкой на FinTech

---

## Smoke на prod (после деплоя)

1. **Marketing UI** (`/admin/system`): поля `acquiring_fee_percent` / `referral_reinvestment_percent` НЕ редактируются, есть hint
2. **FinTech panel** (`/admin/settings/finances`): все 4 поля = live (45/4.3/1M/true), banner "Live ≠ defaults" НЕ показывается
3. **Калькулятор** на 35 000 THB брони: Acquiring ฿1 731, Pool ฿1 300, Owner ฿1 589 (как сейчас)
4. **Попытка save в Marketing с `acquiring_fee_percent: 0` в body**: warning в логе, значение не сохранено
5. **Попытка save в FinTech с `acquiring=0`**: confirm dialog (НЕ блокировка, но предупреждение)

---

## Definition of Done

- [ ] Defaults в `marketing-settings.js`: acquiring = **4.3**, reinvestment = **45**
- [ ] Defaults в `SystemSettingsMarketing.jsx`: `useState(4.3)`, `useState(45)`
- [ ] Marketing save: `stripFintechKeys` удаляет `acquiring_fee_percent` + `referral_reinvestment_percent`
- [ ] Marketing UI: hidden inputs + hint с ссылкой на FinTech panel
- [ ] FinTech panel: Owner mode hint, "Live ≠ defaults" banner, guardrail confirm
- [ ] `fintech-config-defaults.js`: `REFERRAL_MONTHLY_PROGRAM_CAP_DEFAULT_THB = 1_000_000`
- [ ] Migration `2026_08_31_strip_fintech_keys_from_general.sql` — apply в FannRent + verify
- [ ] 6/6 unit-тестов pass
- [ ] Manual smoke на dev + prod (см. выше) — pass
- [ ] НЕ тронуты: waterfall, payout service, calculator, cap service, fintech_snapshot
- [ ] Git commit message: `Stage 202.19 (Phase B) — FinTech defaults & write-path`

---

## После мержа (Pavel делает)

1. **Коммит + пуш** в `Gostaylo-prod`
2. **Применить migration** в FannRent (Supabase) — strip fintech keys from general
3. **Скинуть мне** ID коммита — обновлю `docs/audits/stage-referral-economics-2026-08-29.md` (раздел "Что осталось" → "✅ ЗАКРЫТО в Phase B")
4. **Потом** Stage 202.19 (собственно Tier advantages + Quests + Locked roadmap) — следующий PR

---

## Документация (обязательно обновить)

- `docs/TECHNICAL_MANIFESTO.md` — "Свежие дельты": Stage 202.19 (Phase B)
- `docs/HISTORY.md` — запись о Phase B
- `docs/audits/stage-referral-economics-2026-08-29.md` — обновить "Фаза A → ✅, Фаза B → ✅" в рекомендациях
- НЕ трогать: ADR-131, ADR-131A, Constitution (не constitution-уровень)

---

**Конец промта.** Скопируй и отправь в Cursor. Если Cursor уточняет — отвечай на основе SSOT (fintech-config-defaults.js, ADR-131, ADR-131A), не выдумывай.

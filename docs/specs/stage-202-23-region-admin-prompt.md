# Stage 202.23 — Admin: assign `local_leader_region_id` — Промт для Cursor

**Зачем:** Stage 202.22 ввёл 5-уровневую community-лестницу. Самый верхний — **«Лидер региона»** — требует `profiles.metadata.local_leader_region_id` (см. `isLocalLeaderRegionAssigned` в `lib/referral/qualified-host-metrics.js`). Сейчас поле **никто не может записать**: ни admin, ни partner, ни self-service. Это блокирует tier, ради которого вся leader-стратегия.

**Этот Stage — только admin-инструмент**, не публичный API. Без денег, без tier-логики, без смены SSOT. По сути: 1 service + 2 API + 1 admin-страница + audit + тесты.

---

## Что строим

1. **Service** `lib/services/admin/local-leader-region.service.js`: `assignRegion`, `clearRegion`, `listAvailableRegions`
2. **API × 2**: `POST /api/v2/admin/local-leader/assign` + `POST /api/v2/admin/local-leader/clear` (admin_staff+)
3. **API × 1 опционально**: `GET /api/v2/admin/local-leader/regions` — список доступных регионов
4. **Admin-страница или секция** — форма: найти юзера → выбрать регион → подтвердить → submit
5. **Audit log** — каждое изменение пишется в `admin_audit_log` (или что у нас SSOT-лог для admin actions)
6. **i18n × 4** языка для admin-UI

---

## Не делать (явно)

- ❌ Не делать self-service «выбери свой регион» — только admin
- ❌ Не показывать `local_leader_region_id` в публичных API (приватность)
- ❌ Не автоматически предлагать регион по гео
- ❌ Не вводить новую tier-логику
- ❌ Не включать L3 live
- ❌ Не делать массовую bulk-assign (только один юзер за раз)
- ❌ Не менять `qualified-host-metrics.js` (он уже читает поле правильно)
- ❌ Не делать отдельный список «кто сейчас лидер региона» (только статус в profile / leaderboard — это Stage 202.24+ если понадобится)

---

## Архитектура

### Новые файлы

```
lib/services/admin/local-leader-region.service.js
  # assignRegion(supabase, { userId, regionId, adminId })
  # clearRegion(supabase, { userId, adminId })
  # listAvailableRegions()

lib/config/leader-regions.js
  # SSOT: starter list регионов (10-15). Источник: cities если есть таблица, иначе hardcoded.

app/api/v2/admin/local-leader/assign/route.js
app/api/v2/admin/local-leader/clear/route.js
app/api/v2/admin/local-leader/regions/route.js   # опционально, можно inline

app/admin/team/local-leader/page.jsx             # или похожее место (см. ниже)
components/admin/team/LocalLeaderRegionForm.jsx  # форма assign
components/admin/team/LocalLeaderCurrentAssignment.jsx  # карточка текущего назначения

__tests__/local-leader-region.test.js
  # 5+ тестов: assign, clear, list, audit, RBAC
```

### Где разместить admin-страницу

**Сначала grep** существующую admin-навигацию (`lib/admin/admin-menu.ts` или похожее). Подходящие места:
- `/admin/team` — если есть раздел «Команда / Лидеры»
- `/admin/users/[id]` — на странице конкретного юзера (как отдельная карточка)
- `/admin/leaderboard` — рядом с лидербордом
- **НЕ** `/admin/finances` (тут только деньги)
- **НЕ** `/admin/settings/finances` (FinTech panel, другая зона)

Если ничего не подходит — создай `/admin/team/local-leader` как отдельный раздел. Добавь в admin-menu, если правило в `.cursorrules` этого требует.

### Файлы, которые НЕ трогаем

- `lib/referral/qualified-host-metrics.js` (он **читает** поле, не пишет)
- `lib/services/marketing/local-leader-tier.service.js` (compute tier, read-only)
- `lib/services/marketing/local-leader-metrics.service.js` (loader)
- `lib/services/finance/fintech-waterfall.js`, `referral-payout.service.js` (SSOT финансов)
- `app/api/v2/referral/me/engagement/route.js` (Stage 202.22 read-only)
- `lib/admin/fintech-owner-canon.js` (Stage 202.21)
- Live `system_fintech_settings`
- ADR-131, ADR-131A

---

## Требования

### 1. `lib/config/leader-regions.js` (SSOT список регионов)

**Сначала проверь**, есть ли `cities` / `regions` / `localities` таблица в Supabase. Если есть — используй. Если нет — hardcoded list в этом файле.

```js
/**
 * Stage 202.23 — список регионов для назначения "Лидер региона".
 * Если в БД есть таблица cities/regions — заменить на SELECT с кэшированием.
 */
export const LEADER_REGIONS = Object.freeze([
  Object.freeze({ id: 'phuket',    i18nKey: 'leaderRegions_phuket' }),
  Object.freeze({ id: 'pattaya',   i18nKey: 'leaderRegions_pattaya' }),
  Object.freeze({ id: 'sochi',     i18nKey: 'leaderRegions_sochi' }),
  Object.freeze({ id: 'moscow',    i18nKey: 'leaderRegions_moscow' }),
  Object.freeze({ id: 'spb',       i18nKey: 'leaderRegions_spb' }),
  Object.freeze({ id: 'krasnoyarsk', i18nKey: 'leaderRegions_krasnoyarsk' }),
  Object.freeze({ id: 'irkutsk',   i18nKey: 'leaderRegions_irkutsk' }),
  Object.freeze({ id: 'vladivostok', i18nKey: 'leaderRegions_vladivostok' }),
  Object.freeze({ id: 'chita',     i18nKey: 'leaderRegions_chita' }),
  Object.freeze({ id: 'ulan_ude',  i18nKey: 'leaderRegions_ulan_ude' }),
  // ... extend as we onboard more regions
])

export function isValidRegionId(id) {
  return LEADER_REGIONS.some((r) => r.id === String(id || '').trim())
}
```

### 2. `lib/services/admin/local-leader-region.service.js`

```js
import { LEADER_REGIONS, isValidRegionId } from '@/lib/config/leader-regions'
import { logAdminAction } from '@/lib/admin/admin-audit'   // SSOT audit helper

export function listAvailableRegions() {
  return LEADER_REGIONS.map((r) => ({ id: r.id, i18nKey: r.i18nKey }))
}

/**
 * Записать `local_leader_region_id` в profiles.metadata.
 * Audit обязателен. RBAC проверяется в API route.
 */
export async function assignRegion(supabase, { userId, regionId, adminId }) {
  if (!supabase) throw new Error('SUPABASE_REQUIRED')
  if (!userId) throw new Error('USER_ID_REQUIRED')
  if (!isValidRegionId(regionId)) throw new Error('INVALID_REGION_ID')
  if (!adminId) throw new Error('ADMIN_ID_REQUIRED')

  // 1. Read existing metadata (для audit before/after)
  const { data: profile, error: readErr } = await supabase
    .from('profiles')
    .select('id, metadata')
    .eq('id', userId)
    .maybeSingle()
  if (readErr) throw readErr
  if (!profile) throw new Error('PROFILE_NOT_FOUND')

  const prev = profile.metadata?.local_leader_region_id || null

  // 2. Write
  const nextMetadata = { ...(profile.metadata || {}), local_leader_region_id: regionId }
  const { error: writeErr } = await supabase
    .from('profiles')
    .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (writeErr) throw writeErr

  // 3. Audit
  await logAdminAction({
    action: 'local_leader_region_assign',
    actorId: adminId,
    targetUserId: userId,
    before: prev,
    after: regionId,
  })

  return { ok: true, userId, regionId, previousRegionId: prev }
}

export async function clearRegion(supabase, { userId, adminId }) {
  // ... симметрично: прочитать → удалить поле → записать → audit
  // Audit action: 'local_leader_region_clear'
}
```

**`logAdminAction`:** посмотри, какой SSOT-хелпер для admin-аудита в проекте (Stage 202.21 использовал `admin-audit.js`). Если есть готовый — используй. Если нет — создай тонкий wrapper, не изобретай новый формат лога.

### 3. API routes

Все три используют **существующую admin-RBAC** (см. `lib/security/admin-staff-access.js` — там `requireAdminStaff` middleware). Проверь, какая конвенция для admin routes в проекте, и следуй ей.

**`POST /api/v2/admin/local-leader/assign`:**
```js
// body: { userId: string, regionId: string }
// response: 200 { ok: true, userId, regionId, previousRegionId }
// 400 INVALID_REGION_ID / USER_ID_REQUIRED
// 401 если не auth
// 403 если не admin_staff
// 404 PROFILE_NOT_FOUND
// 503 DB_UNAVAILABLE
```

**`POST /api/v2/admin/local-leader/clear`:**
```js
// body: { userId: string }
// response: 200 { ok: true, userId, previousRegionId }
```

**`GET /api/v2/admin/local-leader/regions`:**
```js
// response: 200 { regions: [{ id, i18nKey }, ...] }
// Можно без admin-RBAC, но для consistency — с auth
```

### 4. Admin-страница

UI должен иметь:
- **Поиск юзера** — по email или id (используй существующий admin user-search если есть, иначе простой input с debounce)
- **Текущее назначение** (если есть) — карточка: «Сейчас: Пхукет, назначен @admin 2026-08-15», кнопка «Снять»
- **Форма назначения** — select с regions, кнопка «Назначить», confirm dialog
- **Toast** — успех/ошибка
- **Hint** — ссылка на docs/ADR про leader-программу (если есть)
- **Показывать подсказку**, что это **вручную**, не auto-assign: «Назначение лидера региона — ручное решение, не автоматическое»

**Не показывать:** калькулятор, баланс, L1/L2/L3, и прочие referral-числа. Только назначение региона.

### 5. Audit log

Каждое изменение пишет:
```text
action: 'local_leader_region_assign' | 'local_leader_region_clear'
actorId: <admin userId>
targetUserId: <user id>
before: <previous regionId или null>
after: <новый regionId или null>
timestamp: ISO
context: { ip?, userAgent? }  // если проект логирует
```

Используй SSOT audit helper. Не пиши в отдельную таблицу.

### 6. i18n × 4

Создай `lib/translations/slices/admin-local-leader.js`:
- `adminLocalLeader_title` → «Назначение лидера региона» / «Regional leader assignment» / «区域领袖分配» / `...`
- `adminLocalLeader_searchUser` / `currentAssignment` / `assign` / `clear` / `confirm` / `success` / `error_*`
- 10+ ключей × 4 языка

Регионы (`leaderRegions_phuket` и т.д.) — в `lib/translations/slices/leader-regions.js` (или добавь в существующий slice, если есть общий для регионов/городов).

### 7. Тесты (`__tests__/local-leader-region.test.js`)

Минимум 5:
1. `assignRegion` пишет `local_leader_region_id` в `profiles.metadata`, сохраняя остальные поля metadata
2. `assignRegion` reject с `INVALID_REGION_ID` для unknown id
3. `clearRegion` удаляет поле (не весь metadata)
4. `listAvailableRegions` возвращает массив `{ id, i18nKey }`
5. `assignRegion` пишет audit log с before/after
6. `isValidRegionId` правильно валидирует
7. API route assign возвращает 403 для non-admin (если тестовая инфра позволяет)

---

## SSOT — не трогать

- `lib/services/finance/fintech-waterfall.js` (waterfall)
- `lib/services/marketing/referral-payout.service.js` (split 42/10/5/43)
- `lib/services/marketing/referral-public-calculator.service.js` (calculator)
- `lib/services/marketing/referral-program-cap.service.js` (cap 1M)
- `lib/services/marketing/referral-tier-sync.service.js` (% вывода tier'ы)
- `lib/services/marketing/referral-fraud-gate.service.js` (антифрод)
- `lib/referral/qualified-host-metrics.js` (он READ-ONLY, пишет — admin service)
- `lib/services/marketing/local-leader-tier.service.js` (compute)
- `lib/services/marketing/local-leader-metrics.service.js` (loader)
- `lib/services/marketing/quest-progress.service.js`
- `lib/services/marketing/leader-roadmap.service.js`
- `lib/config/leader-tier-thresholds.js`
- `lib/config/fintech-config-defaults.js` (45/4.3/1M/L3 on)
- `lib/admin/fintech-owner-canon.js` (Stage 202.21)
- `app/api/v2/referral/me/engagement/route.js` (Stage 202.22)
- Live `system_fintech_settings`
- ADR-131, ADR-131A

---

## Smoke на prod (после деплоя)

1. **Admin (admin_staff+)**: `/admin/team/local-leader` (или где разместил) — отображается
2. **Поиск юзера** по email — находит
3. **Assign**: выбрал Пхукет → confirm → success → в `profiles.metadata.local_leader_region_id === 'phuket'`
4. **Audit log**: в `admin_audit_log` появилась запись `local_leader_region_assign`
5. **Tier check**: на `/profile/referral` у этого юзера tier изменился на `regional_leader` (если остальные метрики выполняются)
6. **Clear**: кнопка «Снять» → confirm → поле удалено, audit записан
7. **GET regions**: возвращает 10+ регионов
8. **RBAC**: non-admin получает 403 (проверить через curl/Postman)
9. **i18n**: переключение RU/EN/ZH/TH — все строки переводятся
10. **Не сломалось**: Stage 202.22 `/engagement` endpoint, Phase B FinTech guardrails, calculator, leaderboard

---

## Definition of Done

- [ ] 1 service с `assignRegion` + `clearRegion` + `listAvailableRegions`
- [ ] `lib/config/leader-regions.js` с starter list (10+ регионов) + `isValidRegionId`
- [ ] 3 API routes (assign/clear/regions) с admin-RBAC
- [ ] 1 admin-страница или секция с формой assign/clear + confirm
- [ ] Audit log на каждое изменение (через SSOT helper)
- [ ] i18n × 4 языка (минимум 10 ключей × 4)
- [ ] 5+ unit-тестов pass
- [ ] НЕ тронут `qualified-host-metrics.js` (он только читает)
- [ ] НЕ сломан Stage 202.22 (`/engagement` работает как раньше)
- [ ] НЕ сломан Phase B (FinTech guardrails работают)
- [ ] НЕ тронуты: waterfall, payout, calculator, cap, tier sync, fraud-gate
- [ ] Git commit: `Stage 202.23 — Admin: assign local_leader_region_id`

---

## После мержа (Pavel делает)

1. **Закоммить** Stage 202.23
2. **Smoke** на dev: assign тестовому юзеру → проверить, что tier показывает `regional_leader` (или прогресс до него)
3. **Smoke на prod** — все 10 пунктов выше
4. **Связаться с медиаперсонами** (это делает возможным реальный use case: назначить Пионера Пхукета = выбрать phuket в admin)

**Дальше** — Referral System Health Audit (1-2 дня Cursor'а по 7 осям).

---

**Конец промта.** Скопируй и отправь в Cursor. Если Cursor уточняет — отвечай на основе SSOT (`qualified-host-metrics.js` — read-only, admin-audit helper, существующая admin-RBAC), **не изобретай** новые таблицы/поля. Region list = hardcoded starter в `lib/config/leader-regions.js`, расширяется по мере онбординга новых зон.

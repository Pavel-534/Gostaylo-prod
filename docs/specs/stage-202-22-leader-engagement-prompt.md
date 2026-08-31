# Stage 202.22 — Local Leader Tier + Quests + Locked Roadmap — Промт для Cursor

**Зачем:** 31.08.2026 валидирована стратегия «Локальный лидер по региону» (5 ролей: Участник / Активист / Наставник / Лидер / Лидер региона) и набраны 2 медиаперсоны (РФ + Пхукет). Сейчас в продукте **нет визуального отображения** этого пути и нет механик engagement. **Этот Stage — только UX-каркас без денег**: пользователь видит, где он сейчас, что можно улучшить и что грядёт.

**Связанные документы:**
- `docs/adr/131A-ambassador-3-1-multi-level.md` (финансовый L1/L2/L3 — НЕ трогаем)
- `docs/audits/stage-referral-economics-2026-08-29.md` (экономика — НЕ трогаем)
- `components/referral/ReferralAmbassadorLevels.jsx` (existing L1/L2/L3 UI — НЕ ломаем)
- `lib/services/marketing/referral-tier-sync.service.js` (existing tier data)
- `lib/services/marketing/referral-fraud-gate.service.js` (qualified host definition)

**Скоуп:** только add новых компонентов и сервисов. **Без денег**, без смены pool/split/cap, без L3 live, без новых `referral_type`, без миграций схемы.

---

## Что строим

1. **Local Leader Tier** (5-уровневая лестница): Участник → Активист → Наставник → Лидер → Лидер региона
2. **Quests Block**: маленькие задания с прогрессом (cap 100 THB из Promo Tank, не из pool)
3. **Locked Roadmap**: что грядёт (Live L3, /leader/[id], Verified-by ускоренный payout и т.д.)
4. **i18n × 4** языка (RU/EN/ZH/TH)
5. **API × 3** для этих трёх блоков

---

## Не делать (явно)

- ❌ Не трогать L1/L2/L3 split 42/10/5/43 и pool 45% (SSOT)
- ❌ Не включать L3 live (нет legal sign-off + нет whitelisted лидеров)
- ❌ Не добавлять новые `referral_type` (Squad Quests >100 THB, лидер-премии — потом)
- ❌ Не выдумывать проценты сверх split (никакого «L1 47% для активиста»)
- ❌ Не ломать `ReferralAmbassadorLevels.jsx` (он про L1/L2/L3, мы про community)
- ❌ Не делать авто-назначение региона (только manual через admin или Notion)
- ❌ Не делать anti-grab / grace month логику в этом Stage (просто отображение)

---

## Архитектура

### Новые файлы

```
components/referral/LocalLeaderTier.jsx                  # 5-уровневая лестница
components/referral/QuestsBlock.jsx                       # список квестов
components/referral/TierRoadmap.jsx                       # locked features
components/referral/LocalLeaderTier.module.css            # emerald/blue/violet палитра

lib/services/marketing/local-leader-tier.service.js       # вычисление tier из реальных метрик
lib/services/marketing/quest-progress.service.js          # прогресс по квестам (read-only)
lib/services/marketing/leader-roadmap.service.js          # static list из config
lib/config/leader-tier-thresholds.js                      # SSOT: 5 уровней + min метрики

app/api/v2/referral/me/local-leader-tier/route.js         # GET current tier + next
app/api/v2/referral/me/quests/route.js                    # GET active quests + progress
app/api/v2/referral/leader-roadmap/route.js               # GET locked features

lib/translations/slices/local-leader-tier.js              # 4 языка
lib/translations/slices/leader-quests.js                  # 4 языка
lib/translations/slices/leader-roadmap.js                 # 4 языка

__tests__/local-leader-tier.test.js                       # tier calculation
__tests__/leader-quests.test.js                           # quest progress
__tests__/leader-roadmap.test.js                          # roadmap list integrity
```

### Файлы, которые НЕ трогаем (важно)

- `components/referral/ReferralAmbassadorLevels.jsx` (L1/L2/L3 визуал — отдельно)
- `lib/services/marketing/referral-tier-sync.service.js` (финансовые tier'ы)
- `lib/services/finance/fintech-waterfall.js` (waterfall SSOT)
- `lib/services/marketing/referral-payout.service.js` (split SSOT)
- `lib/services/marketing/referral-public-calculator.service.js` (calculator formula)
- `lib/config/fintech-config-defaults.js` (финансовые defaults)
- `app/api/v2/admin/settings/route.js` (Phase B guardrails)

### Куда монтируем (read-only)

- `components/referral/ReferralProfilePage.jsx` — добавить 3 новых блока **между** `ReferralYourStatusCard` и `ReferralAmbassadorLevels`
- `app/(cabinet)/partner/page.jsx` или похожий — НЕ монтируем (только профиль)

---

## Требования

### 1. `lib/config/leader-tier-thresholds.js` (SSOT 5 уровней)

```js
/**
 * Stage 202.22 — Local Leader Tier thresholds.
 * 5 уровней; требования к каждому считаются из rolling-30 активности.
 * 
 * ВАЖНО: max_partners — это **qualified hosts** (L1 invite + ≥1 COMPLETED бронь 
 * или host_activation), не просто регистрации. Используем тот же определение, 
 * что в `referral-fraud-gate.service.js`.
 */

export const LEADER_TIERS = Object.freeze([
  Object.freeze({
    id: 'participant',
    order: 1,
    i18nKey: 'localLeaderTier_tier1_name',
    minQualifiedHosts: 0,
    minCompletedBookingsAsHost: 0,
    minEarnedThb: 0,
    requiresRegionAssignment: false,
  }),
  Object.freeze({
    id: 'activist',
    order: 2,
    i18nKey: 'localLeaderTier_tier2_name',
    minQualifiedHosts: 1,
    minCompletedBookingsAsHost: 0,
    minEarnedThb: 0,
    requiresRegionAssignment: false,
  }),
  Object.freeze({
    id: 'mentor',
    order: 3,
    i18nKey: 'localLeaderTier_tier3_name',
    minQualifiedHosts: 3,
    minCompletedBookingsAsHost: 1,
    minEarnedThb: 0,
    requiresRegionAssignment: false,
  }),
  Object.freeze({
    id: 'leader',
    order: 4,
    i18nKey: 'localLeaderTier_tier4_name',
    minQualifiedHosts: 10,
    minCompletedBookingsAsHost: 5,
    minEarnedThb: 1000,
    requiresRegionAssignment: false,
  }),
  Object.freeze({
    id: 'regional_leader',
    order: 5,
    i18nKey: 'localLeaderTier_tier5_name',
    minQualifiedHosts: 10,
    minCompletedBookingsAsHost: 5,
    minEarnedThb: 1000,
    requiresRegionAssignment: true,  // назначается вручную через admin
  }),
])

export const LEADER_TIER_PALETTE = Object.freeze({
  participant: { bg: 'slate-50', text: 'slate-700', accent: 'slate-400' },
  activist: { bg: 'emerald-50', text: 'emerald-700', accent: 'emerald-500' },
  mentor: { bg: 'blue-50', text: 'blue-700', accent: 'blue-500' },
  leader: { bg: 'violet-50', text: 'violet-700', accent: 'violet-500' },
  regional_leader: { bg: 'amber-50', text: 'amber-700', accent: 'amber-500' },
})
```

**Не выдумывать % L1.** Все «преимущества» уровней — это статус, не деньги (см. ADR-131A про split 42/10/5/43).

### 2. `lib/services/marketing/local-leader-tier.service.js`

```js
import { LEADER_TIERS } from '@/lib/config/leader-tier-thresholds'

/**
 * Вычислить текущий Local Leader tier пользователя.
 * Читаем: referrals (qualified), bookings as host, referral_ledger earned.
 * Никаких side-effects, чистая функция.
 */
export function computeLocalLeaderTier({
  qualifiedHostsCount = 0,
  completedBookingsAsHost = 0,
  earnedThb = 0,
  regionAssigned = false,
}) {
  // Идём от высшего к низшему, находим первый подходящий
  for (let i = LEADER_TIERS.length - 1; i >= 0; i--) {
    const tier = LEADER_TIERS[i]
    if (tier.requiresRegionAssignment && !regionAssigned) continue
    if (qualifiedHostsCount < tier.minQualifiedHosts) continue
    if (completedBookingsAsHost < tier.minCompletedBookingsAsHost) continue
    if (earnedThb < tier.minEarnedThb) continue
    return { current: tier, next: i < LEADER_TIERS.length - 1 ? LEADER_TIERS[i + 1] : null }
  }
  // Default — первый уровень
  return { current: LEADER_TIERS[0], next: LEADER_TIERS[1] }
}

/**
 * Сколько нужно до следующего уровня (для прогресс-бара).
 */
export function progressToNextTier(current, metrics) {
  if (!current.next) return { percent: 100, missing: {} }
  const missing = {
    qualifiedHosts: Math.max(0, current.next.minQualifiedHosts - metrics.qualifiedHostsCount),
    completedBookingsAsHost: Math.max(0, current.next.minCompletedBookingsAsHost - metrics.completedBookingsAsHost),
    earnedThb: Math.max(0, current.next.minEarnedThb - metrics.earnedThb),
  }
  // Самый "узкий" параметр определяет прогресс
  const ratios = []
  if (current.next.minQualifiedHosts > 0) {
    ratios.push(metrics.qualifiedHostsCount / current.next.minQualifiedHosts)
  }
  if (current.next.minCompletedBookingsAsHost > 0) {
    ratios.push(metrics.completedBookingsAsHost / current.next.minCompletedBookingsAsHost)
  }
  if (current.next.minEarnedThb > 0) {
    ratios.push(metrics.earnedThb / current.next.minEarnedThb)
  }
  const minRatio = ratios.length > 0 ? Math.min(...ratios) : 1
  return { percent: Math.min(100, Math.round(minRatio * 100)), missing }
}
```

### 3. `lib/services/marketing/quest-progress.service.js`

```js
/**
 * 4 квеста максимум. Cap 100 THB каждый. Данные из существующих таблиц.
 * Никаких новых ledger-записей — это read-only вычисление прогресса.
 */
export const LEADER_QUESTS = Object.freeze([
  Object.freeze({
    id: 'first_invite',
    i18nKey: 'leaderQuests_quest1_title',
    rewardThb: 50,
    check: ({ directInvitesCount }) => directInvitesCount >= 1,
  }),
  Object.freeze({
    id: 'first_booking',
    i18nKey: 'leaderQuests_quest2_title',
    rewardThb: 100,
    check: ({ bookingsViaRefCount }) => bookingsViaRefCount >= 1,
  }),
  Object.freeze({
    id: 'three_hosts_30d',
    i18nKey: 'leaderQuests_quest3_title',
    rewardThb: 100,
    check: ({ qualifiedHostsLast30d }) => qualifiedHostsLast30d >= 3,
  }),
  Object.freeze({
    id: 'first_completed_host',
    i18nKey: 'leaderQuests_quest4_title',
    rewardThb: 100,
    check: ({ completedBookingsAsHost }) => completedBookingsAsHost >= 1,
  }),
])

export function computeQuestsProgress(metrics) {
  return LEADER_QUESTS.map((q) => ({
    id: q.id,
    titleKey: q.i18nKey,
    rewardThb: q.rewardThb,
    completed: q.check(metrics),
  }))
}
```

**Важно:** `completed: true` означает «условие выполнено». **Реальное начисление** — отдельный flow (claim), не в этом Stage. Здесь только UI прогресса.

### 4. `lib/services/marketing/leader-roadmap.service.js`

```js
/**
 * Static list «что грядёт». НЕ план разработки, а витрина для пользователей.
 * Каждый item имеет status: 'locked' | 'in_progress' | 'coming_soon'.
 */
export const LEADER_ROADMAP = Object.freeze([
  Object.freeze({
    id: 'live_l3',
    i18nKey: 'leaderRoadmap_item1_title',
    descKey: 'leaderRoadmap_item1_desc',
    status: 'coming_soon',  // Q4 2026, после legal sign-off
    eta: '2026-Q4',
  }),
  Object.freeze({
    id: 'public_leader_page',
    i18nKey: 'leaderRoadmap_item2_title',
    descKey: 'leaderRoadmap_item2_desc',
    status: 'coming_soon',
    eta: '2026-Q4',
  }),
  Object.freeze({
    id: 'verified_by_fast_payout',
    i18nKey: 'leaderRoadmap_item3_title',
    descKey: 'leaderRoadmap_item3_desc',
    status: 'locked',  // после legal
    eta: 'TBD',
  }),
  Object.freeze({
    id: 'stories_feed',
    i18nKey: 'leaderRoadmap_item4_title',
    descKey: 'leaderRoadmap_item4_desc',
    status: 'coming_soon',
    eta: '2026-Q4',
  }),
  Object.freeze({
    id: 'squad_quests',
    i18nKey: 'leaderRoadmap_item5_title',
    descKey: 'leaderRoadmap_item5_desc',
    status: 'locked',  // после 100+ bookings/mo
    eta: 'TBD',
  }),
])
```

### 5. `components/referral/LocalLeaderTier.jsx`

```jsx
// Props: { currentTier, nextTier, progressPercent, missing, t, locale }
export function LocalLeaderTier({ currentTier, nextTier, progressPercent, missing, t, locale }) {
  const palette = LEADER_TIER_PALETTE[currentTier.id]
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('localLeaderTier_title')}</CardTitle>
        <CardDescription>{t('localLeaderTier_subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`rounded-lg p-4 ${palette.bg}`}>
          <div className="flex items-center justify-between">
            <span className={`font-semibold ${palette.text}`}>
              {t(currentTier.i18nKey)}
            </span>
            {nextTier && (
              <span className="text-sm text-slate-500">
                → {t(nextTier.i18nKey)}
              </span>
            )}
          </div>
          {nextTier && (
            <ProgressBar value={progressPercent} accent={palette.accent} />
          )}
          {nextTier && Object.values(missing).some((v) => v > 0) && (
            <ul className="mt-3 text-sm text-slate-600">
              {missing.qualifiedHosts > 0 && (
                <li>• {t('localLeaderTier_missing_hosts', { n: missing.qualifiedHosts })}</li>
              )}
              {missing.completedBookingsAsHost > 0 && (
                <li>• {t('localLeaderTier_missing_bookings', { n: missing.completedBookingsAsHost })}</li>
              )}
              {missing.earnedThb > 0 && (
                <li>• {t('localLeaderTier_missing_earned', { n: missing.earnedThb })}</li>
              )}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

### 6. `components/referral/QuestsBlock.jsx`

```jsx
// Props: { quests, t }
export function QuestsBlock({ quests, t }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('leaderQuests_title')}</CardTitle>
        <CardDescription>{t('leaderQuests_subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {quests.map((q) => (
            <li key={q.id} className="flex items-center justify-between">
              <span className={q.completed ? 'line-through text-slate-400' : 'text-slate-700'}>
                {t(q.titleKey)}
              </span>
              <span className="text-sm font-medium text-emerald-600">
                +{q.rewardThb} THB
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          {t('leaderQuests_disclaimer')}
        </p>
      </CardContent>
    </Card>
  )
}
```

### 7. `components/referral/TierRoadmap.jsx`

```jsx
// Props: { items, t }
export function TierRoadmap({ items, t }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('leaderRoadmap_title')}</CardTitle>
        <CardDescription>{t('leaderRoadmap_subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              <Badge variant={statusVariant(item.status)}>
                {item.status === 'locked' ? '🔒' : '🛠️'}
              </Badge>
              <div className="flex-1">
                <div className="font-medium text-slate-800">{t(item.i18nKey)}</div>
                <div className="text-sm text-slate-500">{t(item.descKey)}</div>
                {item.eta !== 'TBD' && (
                  <div className="text-xs text-slate-400 mt-1">{item.eta}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function statusVariant(status) {
  if (status === 'locked') return 'outline'
  if (status === 'in_progress') return 'warning'
  return 'secondary'
}
```

### 8. API routes (3 файла)

Все возвращают JSON, read-only, требуют авторизации через `getAuthSession()`.

**`app/api/v2/referral/me/local-leader-tier/route.js`:**
- GET → `{ currentTier, nextTier, progressPercent, missing, metrics }`
- Читает: `referral_relations` (qualified hosts), `bookings` (as host, COMPLETED), `referral_ledger` (earned sum)
- Кэшировать НЕ надо (read-heavy, но cheap queries)

**`app/api/v2/referral/me/quests/route.js`:**
- GET → `{ quests: [{ id, titleKey, rewardThb, completed }] }`
- Те же источники, что и tier

**`app/api/v2/referral/leader-roadmap/route.js`:**
- GET → `{ items: LEADER_ROADMAP }`
- Static, можно без auth (но давайте с auth, для консистентности)

### 9. i18n (3 слайса × 4 языка)

**`lib/translations/slices/local-leader-tier.js`:**
- `localLeaderTier_title`, `localLeaderTier_subtitle`
- `localLeaderTier_tier1_name` → `Участник` / `Participant` / `参与者` / `ผู้เข้าร่วม`
- `localLeaderTier_tier2_name` → `Активист` / `Activist` / `积极分子` / `นักเคลื่อนไหว`
- `localLeaderTier_tier3_name` → `Наставник` / `Mentor` / `导师` / `ที่ปรึกษา`
- `localLeaderTier_tier4_name` → `Лидер` / `Leader` / `领袖` / `ผู้นำ`
- `localLeaderTier_tier5_name` → `Лидер региона` / `Regional Leader` / `区域领袖` / `ผู้นำระดับภูมิภาค`
- `localLeaderTier_missing_hosts` / `_bookings` / `_earned` (с `{n}` плейсхолдером)

**`lib/translations/slices/leader-quests.js`:**
- `leaderQuests_title`, `leaderQuests_subtitle`, `leaderQuests_disclaimer`
- `leaderQuests_quest1_title` → `Первый приглашённый друг`
- `leaderQuests_quest2_title` → `Первая бронь через твою ссылку`
- `leaderQuests_quest3_title` → `3 квалифицированных хоста за 30 дней`
- `leaderQuests_quest4_title` → `Первая COMPLETED бронь как хост`
- И аналоги в 3 языках

**`lib/translations/slices/leader-roadmap.js`:**
- `leaderRoadmap_title`, `leaderRoadmap_subtitle`
- 5 items × title + desc на 4 языках

**`disclaimer` обязателен** для Quests: «Награда начисляется из промо-бюджета, не из пула реферальной программы. Максимум 100 THB за квест.»

### 10. Тесты (3 файла)

**`__tests__/local-leader-tier.test.js`** (минимум 5):
1. `computeLocalLeaderTier` с 0 метриками → `participant`
2. С 1 qualified host → `activist`
3. С 3 qualified + 1 booking → `mentor`
4. С 10 qualified + 5 bookings + 1000 THB → `leader`
5. С 10 qualified + region assigned → `regional_leader`; без region → `leader`
6. `progressToNextTier` правильно считает min ratio (3 параметра → берётся узкий)

**`__tests__/leader-quests.test.js`** (минимум 4):
1. Все квесты имеют `rewardThb ≤ 100`
2. `first_invite` complete когда `directInvitesCount >= 1`
3. `first_booking` complete когда `bookingsViaRefCount >= 1`
4. `three_hosts_30d` complete когда `qualifiedHostsLast30d >= 3`
5. `first_completed_host` complete когда `completedBookingsAsHost >= 1`

**`__tests__/leader-roadmap.test.js`** (минимум 3):
1. Все items имеют `id` уникальный
2. Все items имеют `i18nKey` и `descKey` непустые
3. Никаких promises про деньги (проверить, что в `descKey` нет «THB», «батт», «бат», «₽»)

---

## SSOT — не трогать

- `lib/services/finance/fintech-waterfall.js` (waterfall)
- `lib/services/marketing/referral-payout.service.js` (split 42/10/5/43)
- `lib/services/marketing/referral-public-calculator.service.js` (calculator)
- `lib/services/marketing/referral-program-cap.service.js` (cap 1M)
- `lib/config/fintech-config-defaults.js` (45/4.3/1M/L3 on)
- `lib/admin/fintech-owner-canon.js` (Stage 202.21)
- `components/referral/ReferralAmbassadorLevels.jsx` (existing L1/L2/L3)
- `app/api/v2/admin/settings/route.js` (Phase B guardrails)
- Live `system_fintech_settings`
- ADR-131, ADR-131A (финансы)

---

## Smoke на prod (после деплоя)

1. **`/referral/profile`** (или где `ReferralProfilePage`): 3 новых блока отображаются **между** status card и Ambassador Levels
2. **LocalLeaderTier**: показывает текущий tier + прогресс до следующего (если есть)
3. **QuestsBlock**: 4 квеста, отмечаются выполненными при наличии данных
4. **TierRoadmap**: 5 items, замки/«в работе» видны
5. **i18n**: переключение RU/EN/ZH/TH — все 3 блока переводятся, нет английского в RU-локали
6. **API**: `GET /api/v2/referral/me/local-leader-tier` → 200 с валидной структурой
7. **Калькулятор**: не сломан, те же цифры (35k = 1 300 pool / 1 589 owner)
8. **L1/L2/L3 финансы**: не изменились, leaderboard и tier'ы работают

---

## Definition of Done

- [ ] 3 новых компонента: `LocalLeaderTier`, `QuestsBlock`, `TierRoadmap` (только UI)
- [ ] 3 сервиса: `local-leader-tier`, `quest-progress`, `leader-roadmap` (только read)
- [ ] `lib/config/leader-tier-thresholds.js` — SSOT 5 уровней
- [ ] 3 API routes возвращают JSON без auth-багов
- [ ] 3 i18n слайса × 4 языка = 12 файлов (или один объединённый)
- [ ] 12/12 unit-тестов pass (5+4+3)
- [ ] Монтаж в `ReferralProfilePage.jsx` (только на profile, не на partner dashboard)
- [ ] Disclaimer в Quests: «из промо-бюджета, не из пула»
- [ ] Никаких promises про % L1/L2/L3
- [ ] Никаких side-effects (read-only compute)
- [ ] Manual smoke на dev + prod (см. выше) — pass
- [ ] НЕ тронуты: Ambassador Levels, waterfall, payout, calculator, cap, Phase B guardrails
- [ ] Git commit: `Stage 202.22 — Local Leader Tier + Quests + Locked Roadmap (UX only)`

---

## После мержа (Pavel делает)

1. **Коммит + пуш** в `Gostaylo-prod`
2. **Smoke** на prod (см. 8 пунктов выше)
3. **Скинуть мне ID коммита** — обновлю `docs/TECHNICAL_MANIFESTO.md` (Свежие дельты) и `docs/HISTORY.md`
4. **Дальше**: оффлайн-действия (медиаперсоны + trademark + domains) — это **Pavel only**, код не нужен

---

## Документация (обязательно обновить)

- `docs/TECHNICAL_MANIFESTO.md` — "Свежие дельты": Stage 202.22
- `docs/HISTORY.md` — запись о Stage 202.22
- `lib/config/leader-tier-thresholds.js` — комментарий-ссылка на эту ADR (когда появится)
- НЕ трогать: ADR-131, ADR-131A, Constitution (не constitution-уровень)

---

**Конец промта.** Скопируй и отправь в Cursor. Если Cursor уточняет — отвечай на основе SSOT (LEADER_TIERS, leader-tier-thresholds.js, ADR-131A), **не выдумывай проценты сверх 42/10/5/43**, не добавляй лидер-премии.

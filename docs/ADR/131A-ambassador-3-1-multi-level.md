# ADR-131A: Ambassador Program 3.1 (guest pool L3, staged L4/L5, program cap 1M)

| Field | Value |
|-------|--------|
| **Status** | **Accepted** (владелец: Pavel, 2026-08-19; Legal review disclosure/consent — отдельный track до rollout флага L3) |
| **Stage** | **131.A0** (этот документ — **только политика**, без кода) |
| **Date** | 2026-08-19 |
| **Implementation SSOT (planned, not shipped)** | Stage **131.A1**: `system_fintech_settings` + `FINTECH_CONFIG_DEFAULTS` + `ReferralPolicyService` / `referral-payout.service.js` + `referral-program-cap.service.js`. Stage **131.A2**: L4/L5 после gate. |
| **Deciders** | Product owner, Finance, Engineering, Legal (counsel) |
| **Supersedes (partially, after Accepted)** | ADR-131 инвариант «максимальная глубина monetization на одну бронь: **L2**»; guest pool split **45 / 12 / 43**; program cap **250 000 THB/мес**. **Не** трогает Owner Waterfall, host-activation 70/30, FX, withdrawal fee. |
| **SSOT after adoption** | Этот ADR + `ARCHITECTURAL_DECISIONS.md` (§ Ambassador) + `docs/guides/referral/REFERRAL_OWNER_GUIDE.md` + `docs/guides/referral/REFERRAL_ACCOUNTING.md` |
| **Related** | ADR-131 (Ambassador 3.0), ADR-133 (Team Analytics L1/L2 «от меня»), ADR-134 (payout FX), ADR-097 (financial model) |

**После Accepted:** runtime остаётся ADR-131 до PR Stage **131.A1**. Этот файл **не** меняет формулы в коде.

---

## 1. Context

### 1.1. Продуктовая цель

Сохранить модель ADR-131 (выплаты **только из маржи платформы**, не из GMV и не из escrow хоста), но дать сетевикам **повторяющийся доход глубже прямого invite** — в пределах жёстких caps и юридического disclosure.

Конкурентный ориентир (продуктовый, не копия чужой математики): многоуровневые партнёрские программы с глубиной **3–5** (Uber / Booking / BlaBlaCar / «приведи друга» у российских сервисов доставки).

### 1.2. As-is (код, 2026-08 — факты)

| Контур | Поведение | Где |
|--------|-----------|-----|
| **Guest pool split** | L1 **45%** + L2 **12%** + referee **43%** = 100%. L3+ **не monetized**. | `lib/config/fintech-config-defaults.js:23–38`; `ReferralPolicyService.resolveLiveGuestPoolPayout` |
| **L2 live** | Одна upline-строка `split_role: 'l2_mentor'`; `ancestor_path[length-2]`. Флаг `ambassador_guest_l2_enabled`. | `referral-payout.service.js` `createL2PendingLedgerRow`; `resolveGuestL2ReferrerId` |
| **L2 shadow** | Если флаг off: L2 share **withhold** владельцу (`l2WithheldThb`), shadow в `bookings.metadata`. | `referral-policy.service.js:226–269`; `referral-guest-l2-shadow.service.js` |
| **Host activation** | Фикс `partner_activation_bonus_thb` (500); MLM **70 / 30** только L1+L2. | `referral-payout.service.js:723–741` |
| **Дерево** | `network_depth` / `ledger_depth` CHECK **1…32**; payout использует только L1 + `ancestor_path[-2]`. | `migrations/stage72_2_referral_engine.sql`; `lib/referral/referral-network.js` |
| **Program cap** | Колонка SSOT **`referral_monthly_program_cap_thb`** (не `referral_program_cap_thb`). Default **250 000**. Defer → `pending` + `metadata.cap_deferred`. | `referral-program-cap.service.js`; `system-config.service.js` |
| **L2 caps** | 500 THB/бронь; 50 000 THB/мес/mentor (UTC). | `createL2PendingLedgerRow` |
| **80% warn** | `referral-alert-policy.js`: warn **80%** от **отдельного** `referral_admin_monthly_spend_alert_thb` (default **150 000**), не от program cap. TG topic FINANCE. | `referral-notification.service.js` `maybeNotifyMonthlySpendApproaching` |
| **L3/L4/L5 percents** | **Нет** ключей `ambassador_guest_pool_l3_*` / `maxLevel`. | grep 2026-08 |
| **Оферта** | `/legal/public-offer/` (`PublicOfferLegalContent`). Колонки `referral_mlm_consent_at` **нет**. | `app/(marketing)/legal/public-offer/page.js` |

Оценка нагрузки на текущий program cap (продуктовая, не формула кода): **250 000 THB/мес** при среднем пуле порядка **~3 000 THB/бронь** ≈ **~83** реферальных COMPLETED в месяц на всю программу. Один крупный амбассадор упирается в потолок раньше, чем сеть успевает вырасти.

### 1.3. Проблема

1. **Нет мотивации строить сетку глубже L1.** L2 — бонус наставника прямого invite; «дед» с поездки правнука получает **0** (ADR-131 инвариант).
2. **Конкурентный паритет.** Глубина 3–5 — ожидаемый стандарт у сетевиков; L2-only выглядит как «простая рефералка», не как команда.
3. **Program cap 250k слишком тесный** для реального трафика супер-амбассадора.

ADR-131 Owner Waterfall, safety 95%, FX markup вне пула, host-activation 70/30 — **проблемой не являются** и в этом ADR не пересматриваются.

---

## 2. Decision summary

**Ambassador 3.1** — три столпа **поверх** ADR-131:

1. **Guest pool L3 (Stage 131.A1)** — третий upline получает долю **того же** referral pool; split **42 / 10 / 5 / 43**; L3 только если бенефициар прошёл anti-fraud gate (≥ 10 прямых **партнёров**).
2. **Program cap 1 000 000 THB/мес** — та же колонка `referral_monthly_program_cap_thb`; warn при **80% этого cap**.
3. **Staged L4/L5 (Stage 131.A2)** — не в MVP; только после числового gate и owner sign-off.

**Инварианты ADR-131, которые 131A не отменяет:**

- Выплаты **только из маржи платформы** (guest fee + host fee), **never** из `partner_earnings`, escrow хоста и **`fx_markup_thb`**.
- `SAFETY_LOCK_MAX_SHARE = 0.95` platform gross.
- Wallet credit только через `wallet_apply_operation`; ledger SSOT — `referral_ledger`.
- Accrual guest/host по-прежнему на **`COMPLETED`**, не на paid/confirmed (`referral-lifecycle-hook.js`).
- **% от GMV брони запрещён** (см. §7 альтернатива 4).
- Host activation MLM остаётся **L1/L2 70/30**, без L3+.
- Комиссия банка за вывод (1.5%) — на получателе (ADR-131 §10 / ADR-134).

**Новый инвариант (после Accepted):** максимальная глубина monetization guest pool на одну бронь = **L3** (Stage 131.A1) / **L5** (только после Stage 131.A2). Дерево по-прежнему может быть до 32 hops; **payout не глубже принятой стадии**.

---

## 3. Stage 131.A0 / A1 / A2 (карта работ)

| Stage | Что | Код |
|-------|-----|-----|
| **131.A0** | Этот ADR. Review владельца + Legal. | **Нет.** |
| **131.A1** (MVP, цель ~2 недели после Accepted) | L3 + новые % + cap 1M + legal disclosure/consent + 80% warn от program cap | Отдельный PR / промпт |
| **131.A2** (через 2–3 мес. реальных данных) | L4 2% + L5 1%; L1 40% | Только если выполнен gate §5 |

После перевода в Accepted (см. header ниже) — runtime остаётся ADR-131 до PR Stage A1. Документ зафиксирован.

---

## 4. Stage 131.A1 — guest pool L3 (MVP)

### 4.1. Split (сумма = 100% пула)

Пул по-прежнему: `AdjustedNet × referral_reinvestment_percent` (launch **45%**), затем safety cap. Меняется **только нарезка пула**.

| Уровень | Что считается | Default % от pool | Per-user cap (THB / UTC month) | Per-booking cap | Условие |
|---------|---------------|-------------------|-------------------------------|-----------------|---------|
| **L1** | Бронь прямого `referee` → `relation.referrer_id` | **42%** (было 45, −3) | нет | нет | всегда, если есть relation |
| **L2** | Бронь внука → `ancestor_path[length-2]` | **10%** (было 12, −2) | **50 000** (без изменения) | **500** (ADR-131, без изменения) | live ledger **или** shadow withhold — как сейчас |
| **L3** (NEW) | Бронь правнука → `ancestor_path[length-3]` | **5%** | **20 000** | **500** (как L2, §9.1) | бенефициар L3 имеет **≥ 10** прямых партнёров **и** `referral_mlm_consent_at` |
| **Referee cashback** | Приглашённый гость | **43%** (без изменений) | — | — | всегда |

**42 + 10 + 5 + 43 = 100.**

Резолвер upline (канон как у L2 сегодня):

```
L1 = relation.referrer_id
L2 = ancestor_path[length - 2]  если ≠ L1
L3 = ancestor_path[length - 3]  если задан и ≠ L1 и ≠ L2
```

Нет L3 в цепочке (короткое дерево) **или** не пройден gate → доля L3 **не** перераспределяется на L1/L2/guest.

**Инвариант неразмещённой доли:** L2 shadow (флаг live off) и/или L3 skip (нет upline / gate fail / monthly cap 0 remaining) → соответствующие THB **withhold владельцу** (`l2WithheldThb` / `l3WithheldThb`), тот же паттерн, что ADR-131 shadow L2. Drift округления — в referee, как сейчас при live L2 (`deriveGuestPoolSplit`).

### 4.2. Anti-fraud gate L3

Ключ: `ambassador_guest_l3_min_direct_partners` default **10**.

**SSOT счёта:** существующий `ReferralTierSyncService.countDirectPartnersInvited(beneficiaryId)` — число **прямых** `referral_relations` , у которых `profiles.role = 'PARTNER'` (`referral-tier-sync.service.js:89–104`). **Не** считать всех гостей-рефери. **Не** вводить второй счётчик «10 аккаунтов».

Смысл: L3 нельзя включить себе через ферму фейковых L1-гостей; нужен supply-side вес (как Ambassador tier, порог 20 партнёров — L3-gate **между** Pro=5 и Ambassador=20).

Проверка — **на бенефициаре L3 в момент accrual**, не на госте поездки.

### 4.3. Program cap

| Параметр | ADR-131 | ADR-131A Stage 1 |
|----------|---------|------------------|
| Колонка | `system_fintech_settings.referral_monthly_program_cap_thb` | **та же** (не плодить `referral_program_cap_thb`) |
| Default | 250 000 | **1 000 000** THB/мес (~$30k USD при грубом 33–35 THB/USD — **не** FX SSOT) |
| Поведение при превышении | defer, `cap_deferred` | **без изменения механики** (`referral-program-cap.service.js`) |
| Flag | `ambassador_3_program_cap_enabled` | без изменения |

Оценка 1M: при том же ~3 000 THB/бронь ≈ **~330** реферальных COMPLETED/мес на программу (порядок величины, не SLA).

### 4.4. Admin warning 80%

При **≥ 80%** `referral_monthly_program_cap_thb` за UTC-месяц:

- сигнал в существующий контур `REFERRAL_ADMIN_ALERT` / TG topic **FINANCE**;
- видимый warning на **`/admin/finances`** (FinTech / liability — тот же кабинет, что referral spend).

**Два порога, два имени в admin UI (§9.7):** «early warning · referral spend growing» = существующий **150 000** `referral_admin_monthly_spend_alert_thb`; «approaching program cap» = **80%** от `referral_monthly_program_cap_thb` (при cap 1M → **800 000**). Не сливать в один SSOT.

### 4.5. Runtime-ключи (план, не миграция в A0)

Добавить в `system_fintech_settings` / `FINTECH_CONFIG_DEFAULTS` (имена в стиле существующих `ambassador_guest_pool_l2_*`):

| Ключ | Default Stage 1 |
|------|-----------------|
| `ambassador_guest_pool_l1_percent` | 42 |
| `ambassador_guest_pool_l2_percent` | 10 |
| `ambassador_guest_pool_l3_percent` | 5 |
| `ambassador_guest_pool_referee_percent` | 43 |
| `ambassador_guest_l3_enabled` | `false` до QA; `true` на rollout (до флага — только shadow, §9.2) |
| `ambassador_guest_l3_min_direct_partners` | 10 |
| `ambassador_guest_l3_max_thb_per_booking` | 500 |
| `ambassador_guest_l3_max_thb_per_month` | 20 000 |
| `referral_monthly_program_cap_thb` | 1 000 000 |

Валидация: `fintech-settings-validation.js` сегодня суммирует **L1+L2+referee = 100** при L2 on. После A1: **L1+L2+L3+referee = 100** при L3 on; при L3 off — либо withhold L3 в знаменателе (как L2 shadow), либо явный режим `legacy_45_12_43` до cutover. **Параллельных split’ов в коде быть не должно.**

`referral_reward_rules.split_ratio` **не** становится SSOT уровней (остаётся hold / min booking / shadow A/B, Stage 123.0).

`pricing_profiles` **не** хранит MLM percents.

### 4.6. Ledger / notify (план A1)

- Новая guest-строка: `type=bonus`, `referral_type=guest_booking`, `metadata.split_role = 'l3_upline'` (или согласованный канон в том же PR). Unique `(booking_id, type, referral_type, referrer_id)` уже позволяет 3 bonus-получателей.
- `ledger_depth` остаётся снимком дерева; KPI «от меня» — ADR-133: расширить bucket **L3** отдельно от `l2NetworkThb`, не смешивать в одну «сеть».
- Notify: существующие `REFERRAL_BONUS_EARNED` / `HELD` уже печатают `L${ledgerDepth}` — проверить copy, чтобы L3 не выглядел как host activation.
- Калькулятор `/about/referral` и `referral-public-calculator.service.js` — те же percents, иначе UI врёт.

### 4.7. Out of scope Stage 1

- L4/L5 percents и caps.
- Host activation L3+.
- Смена `referral_reinvestment_percent` (остаётся 45%).
- Public (unauthenticated) leaderboard.
- Telegram-канал топа амбассадоров.
- Events `friend_booked` / `friend_paid` (отдельный backlog notify).

---

## 5. Stage 131.A2 — L4 / L5 (не MVP)

Только если **все** условия истинны (owner sign-off в том же PR, что код):

1. Stage 131.A1 в проде **≥ 2 месяца**.
2. **Top-10** амбассадоров по `referral_ledger_leaderboard_for_period` (UTC month, `status=earned`) зарабатывают **каждый > 100 000 THB** в **двух подряд** UTC-месяцах.
3. Нет runaway: program cap не в defer > N дней подряд (порог N — Finance в runbook A2).
4. Legal: оферта §6 уже покрывает «до 5 уровней» **до** включения L4/L5.

| Уровень | % от pool | Cap THB/мес (UTC) |
|---------|-----------|-------------------|
| L1 | **40%** | нет |
| L2 | **10%** | 50 000 |
| L3 | **5%** | 20 000 |
| L4 | **2%** | 10 000 |
| L5 | **1%** | 5 000 |
| Referee | **42%** | — |

**40+10+5+2+1+42 = 100.** (Cashback снижается с 43 → 42, чтобы сумма сошлась; это **явное** решение A2, не «добавить 3% сверху».)

Upline: `ancestor_path[length-4]` / `[length-5]`. Неразмещённые L4/L5 → withhold владельцу. Gate (§9.4): **L4 = 20** прямых PARTNER (`countDirectPartnersInvited`, порог Ambassador tier), **L5 = 50**. Без gate на L5 — запрещено.

---

## 6. Юридические требования (A1 и A2)

Это **продуктовые обязательства** из постановки владельца. Формулировки оферты утверждает **юрист**; агент не даёт правовой квалификации ст. 172.2 УК РФ.

1. **`/legal/public-offer/`** — раздел «Многоуровневая партнёрская программа»:
   - доход зависит от привлечения и **активности** приглашённых;
   - **нет** гарантированного дохода;
   - средний доход **активного** амбассадора за последний квартал: плейсхолдер **___**, обновление **раз в квартал** (источник цифры — Finance; не хардкод в UI без SSOT).
2. **`/profile/referral`** — постоянный disclaimer: «Вы участвуете в многоуровневой партнёрской программе. Доход зависит от активности приглашённых.» i18n: без литерала бренда, `{brand}` если нужен.
3. **Первый вход** на `/profile/referral` — чекбокс принятия условий; timestamp **`profiles.referral_mlm_consent_at`** (timestamptz, nullable). Паттерн UI: существующий `LegalConsentCheckboxRow`. Повторно не спрашивать, если timestamp уже есть. Кабинет рефералки **не** блокировать для чтения оферты. Без consent: **блокировать только L3+** accrual (§9.5); L1+L2+referee без регресса.

Реализация согласия — Stage **131.A1**, не A0.

---

## 7. Consequences

### 7.1. Положительные

- Мотивация строить команду **глубже одного hop**.
- Рычаг viral growth для блогеров / сетевиков без смены Owner Waterfall.
- Конкурентный паритет по **глубине** (не по % от чека гостя).

### 7.2. Отрицательные и митигация

| Риск | Митигация в этом ADR |
|------|----------------------|
| Квалификация MLM / ст. 172.2 УК РФ (юрисдикция РФ) | Disclosure в оферте + consent + «нет гарантии дохода» + квартальная статистика; **review counsel** до Accepted |
| Fraud / фермы аккаунтов | L3 gate = 10 **партнёров** (`countDirectPartnersInvited`); существующий `ReferralFraudGate`; L2/L3 monthly caps; program cap |
| Сложность payout / drift 100% | Withhold неразмещённых долей владельцу; валидация суммы % = 100; атомарный credit как сейчас |
| Путаница L1/L2 guest vs host 70/30 | Не смешивать контуры; owner guide обновить в PR A1 |
| ADR-133 KPI «сеть» смешает L2+L3 | В A1 — отдельный bucket L3 |
| Program cap 1M маскирует unit-economics | Cap — предохранитель, не P&L-цель; ROI отчёты без изменения |

### 7.3. Docs после Accepted + PR A1 (не A0)

В том же PR, что код A1: `ARCHITECTURAL_DECISIONS.md` (Accepted), `docs/guides/referral/REFERRAL_OWNER_GUIDE.md`, `REFERRAL_ACCOUNTING.md`, `BUSINESS_LOGIC_REFERRAL.md` (если ещё канон), `docs/TECHNICAL_MANIFESTO.md` (свежая дельта), `docs/CONSTITUTION.md` (инвариант глубины), `docs/HISTORY.md`.

---

## 8. Alternatives (рассмотрены и отклонены)

1. **Остаться на L2 (ADR-131 as-is).** Отклонено: нет мотивации сетки, не конкурентно для целевого сегмента сетевиков.
2. **Сразу L1–L5 в MVP.** Отклонено: нет полевых данных; disclosure/consent не проверены; выше юридический и fraud surface.
3. **Убрать все caps.** Отклонено: runaway при fraud и при одном супер-амбассадоре против P&L.
4. **% от GMV вместо % от пула.** Отклонено: ломает инвариант «только маржа»; требует переделки pricing / `price-truth`; не в фокусе 131A.
5. **Новая колонка `referral_program_cap_thb`.** Отклонено: SSOT уже есть — `referral_monthly_program_cap_thb`. Параллельное имя запрещено.
6. **L3 без gate (любой upline).** Отклонено: ферма фейковых L1 открывает пассив L3.

---

## 9. Open questions — резолюции владельца

Все вопросы §9 решены владельцем (Pavel, 2026-08-19). Резолюции — SSOT для Stage A1 и A2.

**9.1. L3 per-booking cap.** Решение: **500 THB** (как L2). Per-booking 500 + monthly 20K = двойная защита от одной крупной брони. Без per-booking cap одна бронь 5M THB subtotal дала бы 5% × ~250K THB L3 = больше чем monthly 20K.

**9.2. Shadow L3.** Решение: **да, shadow L3 по умолчанию** (как L2). Пока `ambassador_guest_l3_enabled = false`, доля L3 пишется в `bookings.metadata.l3WithheldThb`, не в ledger. При включении флага — live ledger row.

**9.3. A2 cashback 43 → 42.** Решение: **подтверждаю 42%**. L1 не режем. Снижение cashback на 1% ради глубины 5 уровней — справедливый компромисс.

**9.4. L4/L5 min-partners gate.** Решение: **L4 = 20 PARTNERs, L5 = 50 PARTNERs**. Tier-gated: L4 требует «Ambassador» tier (20 партнёров), L5 — топовый сегмент (50). Тот же SSOT `countDirectPartnersInvited`. Без gate на L5 — отклонить, иначе fraud surface.

**9.5. Consent fail-closed.** Решение: **блокировать только L3+**. L1+L2+referee продолжают работать как сейчас. Без consent пользователь теряет только пассивный доход от L3, не активный прямой заработок. Справедливо, не регрессирует.

**9.6. Квартальный «средний доход».** Решение: **avg earned на active ambassador**.
- Numerator: `SUM(referral_ledger.amount_thb)` WHERE `status='earned'` AND `earned_at IN [start_quarter, end_quarter)`.
- Denominator: `COUNT(DISTINCT referrer_id)` WHERE `status='earned'` AND ≥1 COMPLETED referee в этом периоде.
- Cron: 1-е число каждого квартала. Запись в `referral_program_stats` (таблица-кандидат, обсудить с Finance). В оферту — через SSOT-ключ, не хардкод.

**9.7. 150k admin alert vs 80% of 1M.** Решение: **два разных порога с разными именами в admin UI**. SSOT остаётся как есть. Переименование: «early warning · referral spend growing» (150K) и «approaching program cap» (800K от 1M).

---

## 10. Acceptance criteria

### 10.1. Stage 131.A0 (этот документ)

- [x] ADR в `docs/ADR/131A-ambassador-3-1-multi-level.md`.
- [x] Status → **Accepted** (владелец Pavel, 2026-08-19; Legal disclosure/consent — отдельный track до L3 live).
- [x] `ARCHITECTURAL_DECISIONS.md` переводит 131A из Draft в Accepted **в том же цикле**, что Status.

### 10.2. Stage 131.A1 (код, отдельный PR)

- [ ] Одна COMPLETED бронь в цепочке A→B→C→guest даёт ledger: L1(B), L2(A если hop), L3(дед если hop + gate), cashback(guest); сумма долей = pool ±1 THB.
- [ ] L3 = 0 и `l3WithheldThb > 0`, если у деда меньше 10 PARTNER-рефери **или** нет `ancestor_path[-3]`.
- [ ] L3 monthly cap 20k на бенефициара (UTC); L2 caps 500 / 50k без регресса.
- [ ] Program cap default 1_000_000; defer как сейчас.
- [ ] 80% program cap → admin/TG warning.
- [ ] Калькулятор = серверный split ±1 THB.
- [ ] Оферта + disclaimer + `referral_mlm_consent_at`.
- [ ] Host activation 70/30 **без** L3-строк.
- [ ] Валидация % = 100 в admin save.
- [ ] Тесты/smoke на split + gate + withhold + cap.

Дополнение к 10.2 (Stage A1, дополнительные критерии):

- [ ] L3 per-booking cap 500 THB на бронь (как L2).
- [ ] Shadow L3 в `bookings.metadata.l3WithheldThb` при `ambassador_guest_l3_enabled = false`.
- [ ] Consent check на accrual L3 (L1+L2 не трогаем).
- [ ] Квартальный cron для `referral_program_stats` (формула §9.6).
- [ ] Admin UI: rename «early warning» (150K) vs «approaching cap» (800K).

### 10.3. Stage 131.A2

- [ ] Gate §5 выполнен и записан в PR.
- [ ] Split 40/10/5/2/1/42 + caps L4/L5.
- [ ] L4 gate = 20 PARTNER; L5 gate = 50 PARTNER (`countDirectPartnersInvited`).
- [ ] Оферта уже содержит «до 5 уровней».

---

## 11. Rollout (A1)

| Flag | Default до QA | Rollout |
|------|---------------|---------|
| `ambassador_guest_l3_enabled` | `false` | `true` после smoke + Legal |
| `ambassador_guest_l2_enabled` | как в проде на момент A1 | не регрессировать |
| `ambassador_3_program_cap_enabled` | `true` | cap value 1M |

Cutover percents 45/12/43 → 42/10/5/43 — **одна** запись `system_fintech_settings`, не два кода «if old split».

---

## 13. Owner note

Pavel, 2026-08-19: ADR-131A принят к реализации в Stage A1. Все 7 вопросов §9 решены. Юридический review текста disclosure в оферте и формулировки consent — отдельный track до момента, когда `ambassador_guest_l3_enabled` будет переключён в `true` в проде. До этого момента ledger L3 не пишется; только shadow L3 в metadata. Это не отменяет необходимости counsel review до rollout, но разделяет продуктовое и юридическое решение.

---

## 14. References

| Документ / код | Зачем |
|----------------|--------|
| `docs/ADR/131-ambassador-3-0.md` | Базовая экономика, L2 cap, withhold, waterfall |
| `ARCHITECTURAL_DECISIONS.md` § Ambassador | Policy index |
| `lib/config/fintech-config-defaults.js:23–38` | Текущие defaults 45/12/43, cap 250k |
| `lib/services/marketing/referral-payout.service.js:173–250, 485–499, 723–741` | L2 live row; host MLM L1/L2 only |
| `lib/services/marketing/referral-policy.service.js:200–269` | Guest split + shadow withhold |
| `lib/services/marketing/referral-guest-l2-shadow.service.js:18–25` | `ancestor_path[-2]` |
| `lib/services/marketing/referral-program-cap.service.js` | Monthly program cap |
| `lib/services/marketing/referral-tier-sync.service.js:89–104` | Direct **PARTNER** count |
| `lib/admin/referral-alert-policy.js` | 80% warn (сейчас от 150k alert) |
| `docs/guides/referral/REFERRAL_OWNER_GUIDE.md` | «L3+ не monetized» — обновить в A1 |
| `docs/guides/referral/REFERRAL_ACCOUNTING.md` | Accounting SSOT |
| `docs/ADR/133-team-analytics-growth.md` | KPI «от меня»; расширить в A1 |
| `app/(marketing)/legal/public-offer/page.js` | Поверхность оферты |

---

## Appendix A — Что не меняет 131A

- Owner waterfall (acquiring, USN, VAT, reserve bank).
- `referral_reinvestment_percent` launch 45%.
- Promo tank / welcome / host activation bonus source.
- Ambassador **tiers** Beginner/Pro/Ambassador (withdrawable 60/75/85) — это не L3/L4/L5 комиссии.
- Dual-market FX (ADR-131 §3, ADR-181).
- Withdrawal FX lock (ADR-134).

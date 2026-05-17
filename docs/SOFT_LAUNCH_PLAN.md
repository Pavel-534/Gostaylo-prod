# GoStayLo — Soft Launch Plan (Stage 100)

**Горизонт:** первые **20 пользователей** (10–12 гостей, 5–8 партнёров) + демо для инвесторов.  
**Финансы:** Financial Model v2.0 (ADR-097), pre-launch checklist пройден.

---

## 1. Production readiness (до трафика)

### 1.1 Feature flags

| Переменная | Staging | Production (soft launch) |
|------------|---------|---------------------------|
| `PRICING_ENGINE_V2` | `true` | `true` после smoke A |
| `FISCAL_SANDBOX` | `true` | **`false`** |
| `FISCAL_PROVIDER_URL` | mock/sandbox | **prod OFD** |
| `FISCAL_KG_SUPPLIER_NAME` | set | set (ОсОО) |
| `FISCAL_RU_AGENT_INN` | set | set |

Также: `system_settings.general.pricingEngineV2Enabled` — согласовать с env (не противоречить).

### 1.2 Cron (Vercel + внешний при Hobby)

См. **README → External cron**. Все роуты: `assertCronAuthorized` (`401` без секрета).

| Job | Schedule | Назначение |
|-----|----------|------------|
| `escrow-thaw` | hourly (external) | PAID_ESCROW → THAWED |
| `promote-ready-for-payout` | hourly (external) | THAWED → READY (24h) |
| `payout-batch-pools` | Mon/Thu 07:00 UTC | Treasury DRAFT |
| `financial-health-monitor` | daily 06:30 UTC | PENDING_FISCAL + ledger drift |

Скрипт smoke: `node scripts/financial-smoke-cron.mjs` (staging).

### 1.3 Мониторинг

- Telegram: `PENDING_FISCAL_BACKLOG`, `LEDGER_DRIFT` (через `recordCriticalSignal`).
- Admin: `/admin/settings/finances` — compliance CSV, fiscal retry.
- **Concierge treasury (ручные выплаты):** пошаговый runbook — `docs/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md`.
- Admin disputes: `/admin/disputes` — freeze / close → ledger release.

---

## 2. Когорта первых 20

### 2.1 Отбор партнёров (5–8)

- 1 вертикаль на старте: **stay** (курорт/город).
- KYC: `profiles.is_verified`, payout profile verified.
- Ручной onboarding: звонок 30 мин (эскроу, 24h, споры).
- White-glove: прямой контакт в Telegram support.

### 2.2 Гости (10–12)

- Invite-only или промокод soft-launch.
- Лимит брони: max ฿X / user (опционально в settings).
- Первые 3 брони — ручной просмотр compliance export.

### 2.3 Инвесторы / демо

- Не в когорте live money без договорённости.
- Демо: staging + one-pager + 1 реальная анонимизированная compliance CSV.

---

## 3. Onboarding (партнёр)

1. Регистрация → верификация документов.
2. Публикация 1 листинга (wizard, draft-before-upload).
3. Тестовая бронь (внутренняя) на staging.
4. Prod: первый реальный гость.
5. Walkthrough `/partner/finances`: эскроу → 24h → доступно → спор.

**Ключевые фразы support:**

- «Деньги в эскроу до завершения проживания».
- «После разморозки — 24 часа, затем “Доступно к выводу”».
- «При споре средства блокируются до решения администратора».

---

## 4. Поддержка

| Канал | SLA soft launch |
|-------|-----------------|
| In-app chat | < 2h рабочие часы |
| Telegram support | < 1h |
| Disputes | Admin в течение 72h SLA (авто-resolve по правилам) |

Эскалация финансов: FinTech on-call → compliance export по `booking_id`.

---

## 5. Метрики (первые 14 дней)

| Метрика | Цель | Источник |
|---------|------|----------|
| Успешные оплаты v2 | 100% snapshot v2 | `bookings.pricing_snapshot` |
| PENDING_FISCAL backlog | < 5 | cron `financial-health-monitor` |
| Ledger drift partners | 0 | reconciliation в finances-summary |
| Disputes OPEN | track | `disputes` |
| Time to thaw | по категории | `escrow_thaw_at` |
| Partner NPS (ручной опрос) | ≥ 8/10 | форма |

**North star soft launch:** 10 completed stays без финансового инцидента.

---

## 6. Недельный план

### Неделя 0 — Gate

- [ ] `docs/PRE_LAUNCH_CHECKLIST.md` §1–§11 (Stage 100)
- [ ] `docs/FINANCIAL_SMOKE_E2E.md` сценарии A + B
- [ ] Attestation v2: intentional `PRICE_MISMATCH` test on staging (reject tampered total)
- [ ] Prod env: `PRICING_ENGINE_V2=true`, `FISCAL_SANDBOX=false`
- [ ] External cron hourly registered (promote + thaw)
- [ ] `docs/legal/IT_SERVICE_KG_CONTRACT_SUMMARY.md` — бухгалтерия OK

### Неделя 1 — Cohort 1 (5+5)

- День 1–2: 3 партнёра, 5 гостей.
- День 3–5: daily health cron review.
- Пятница: первый payout pool (если есть READY).

### Неделя 2 — Cohort 2 (до 20)

- +2–3 партнёра, вторая категория (transport) — один smoke B.
- Retrospective: SSOT gaps → ADR/manifesto update.

---

## 7. Rollback

| Триггер | Действие |
|---------|----------|
| Массовый PENDING_FISCAL | `FISCAL_SANDBOX=true`, fix OFD |
| Ledger drift > 3 partners | Стоп новых оплат, `PRICING_ENGINE_V2=false` |
| Неверные guest totals | Откат flag v2, incident postmortem |

---

## 8. Readiness sign-off (Stage 100)

| Критерий | Статус |
|----------|--------|
| Financial core (v2 snapshot, ledger, fiscal hook) | ✅ Code complete |
| Attestation v2 locked | ✅ `booking-price-integrity.js` |
| Partner/admin UI wired | ✅ finances + FinTech admin |
| Dispute payout freeze | ✅ Stage 99 |
| Cron + monitoring | ✅ + README external scheduler |
| Legal wording SSOT | ✅ `docs/legal/IT_SERVICE_KG_CONTRACT_SUMMARY.md` |
| **Prod live payments** | ☐ После gate checklist + 1 prod smoke |

**Вердикт:** готовы к **soft launch (20 users)** после прохождения Недели 0 и одной реальной оплаты на prod с бухгалтерским чеком.

---

## 9. Связанные документы

- `docs/PRE_LAUNCH_CHECKLIST.md`
- `docs/FINANCIAL_SMOKE_E2E.md`
- `docs/INVESTOR_ONE_PAGER_FINANCIAL_V2.md`
- `docs/ADR/097-financial-model-v2.md`
- `docs/legal/IT_SERVICE_KG_CONTRACT_SUMMARY.md`
- `lib/booking/booking-status-display.js`

# Roadmap — планы после запуска

> Собран из пометок **future / backlog / Phase B–D / deferred** в архиве паспорта и связанных docs.  
> Активные правила — [`CONSTITUTION.md`](./CONSTITUTION.md). Закрытые Stage — [`HISTORY.md`](./HISTORY.md).

---

## 1. Operational readiness (деньги и надёжность)

Приоритет после закрытия аналитической Phase D: **не новые дашборды**, а live money + cron.

| Тема | Суть | Источник |
|------|------|----------|
| Live payments | Боевой контур YooKassa + fiscal + prod verify/smoke | Phase D roadmap P0; `PRE_REAL_PAYMENTS_CHECKLIST`, Go/No-Go |
| Launch risks (RU/TH) | Реестр R01–R12 — остаточный риск soft launch | [`LAUNCH_RISK_REGISTER.md`](./LAUNCH_RISK_REGISTER.md) |
| ADR-203 ledger SoT | Phase 1 shadow live (`ledger-shadow-reconcile`); **30d zeroDrift** → Phase 2/3 flip | `ARCHITECTURAL_DECISIONS.md` ADR-203 |
| External cron on prod | Hourly `escrow-thaw`, `promote-ready-for-payout`, payout pools | `CRON_EXTERNAL_FINANCIAL.md` |
| Cron observability | Единая «последний successful run» + TG `[STALE_CRON]` | MONEY_FLOW_04 P1 — `runStaleCronMonitor` + FinTech health last-success |
| Prod env audit | Один реестр всех financial env | `PRODUCTION_ENV.md` |
| Controlled live bookings | 10–50 Concierge-броней с ручным payout | Phase D §4.2; Day-0: [`runbooks/DAY0_SOFT_LAUNCH_CHECKLIST.md`](./runbooks/DAY0_SOFT_LAUNCH_CHECKLIST.md) |
| Partner payout SOP | Документ + UI checklist | `CONCIERGE_LAUNCH_TREASURY_RUNBOOK` |
| Referral withdrawal ops | Ручная очередь до автоматизации банка | Phase D; GO/No-Go |
| **Concierge Supply (M2.0)** | Cold-start listings: ops ingest Sheets/PDF → drafts on shadow partner → magic claim → review → publish + iCal | **ADR-210** — [`ADR/210-concierge-supply-pipeline.md`](./ADR/210-concierge-supply-pipeline.md); **Slice 1–7.1 Done** (`/admin/concierge` + UX polish); next: more mapping profiles / Drive crawler (ops) |

**Отложено явно:** полная автоматизация referral bank payouts; microservices / analytics warehouse.

---

## 2. Payment rails (довести до READY)

| Рельс | Сейчас | Backlog |
|-------|--------|---------|
| **YooKassa MIR_RU** | READY | Hardening / fiscal / first real payments |
| **Mandarin CARD_INTL** | PARTIAL | Live env + contract + adapter polish |
| **Crypto USDT TRC-20** | PARTIAL | Wallet config / adapter registry polish; Tron webhook path |
| **Stripe** | Absent | Не в runtime (не приоритет) |

---

## 3. MLM / Ambassador L2

| Элемент | Состояние | План |
|---------|-----------|------|
| `ambassador_guest_l2_enabled` | **false** (launch default в `system_fintech_settings`) | Включение live L2 — продуктовое решение владельца |
| Shadow L2 | Пишет `metadata.fintech_snapshot.shadow_l2_thb` без ledger | Наблюдение → решение о live |
| Live L2 | Stub `createL2PendingLedgerRow` / `split_role=l2_mentor` при flag=true | После shadow validation + caps |
| Pool split | `ambassador_guest_pool_*_percent` (45/12/43) при L2 on | Настройка в FinTech admin |
| Supply Builder MLM | `mlm_level*_percent`, `partner_activation_bonus_thb` | Уже в settings; масштабирование — post-PMF |
| **ADR-131A Ambassador 3.1** | **Accepted** (Pavel, 2026-08-19); runtime ещё ADR-131 | Stage **131.A1** код L3 + cap 1M; L4/L5 = Stage 131.A2. [`ADR/131A-ambassador-3-1-multi-level.md`](./ADR/131A-ambassador-3-1-multi-level.md) |

См. `docs/ADR/131-ambassador-3-0.md`, referral financial docs.

---

## 4. Capacitor / native shell / TWA

| Фаза | Содержание | Статус |
|------|------------|--------|
| **Audit + 2–4w plan (2026-08-09)** | Deep audit PWA/TWA/Cap + plan | [`AUDIT_MOBILE_PLATFORMS.md`](./AUDIT_MOBILE_PLATFORMS.md), [`MOBILE_PLATFORMS_PLAN.md`](./MOBILE_PLATFORMS_PLAN.md) |
| Scaffold Cap | `capacitor.config.ts`, `lib/capacitor/*`, AASA/assetlinks **templates** | В репо на `main`; **нет** `@capacitor/*` / `ios`/`android` |
| TWA Android | `mobile/android-twa` (`ru.airento.app`, targetSdk 35) | Gradle есть; **DAL on main broken** (points at Cap id) — P0 in plan |
| **Phase A** | Apple/Google developer, Team ID, APNs, Play SHA, staging URL | Owner blockers |
| **Phase B Cap** | TestFlight MVP: WebView + deep links + push → chat/checkout | Gated; **не** смешивать с main PWA / finance |
| **Phase C** | Cookie/SameSite, badge parity, CI `cap sync`, store vs PWA decision | Post-TestFlight |
| PWA iOS smoke | Matrix + backlog | Fill [`STAGE_189_IOS_SMOKE_RESULTS`](./archive/stages/STAGE_189_IOS_SMOKE_RESULTS.md) before Cap B |

**Инвариант:** никакой второй pricing/escrow/math в native-слое.

См. `docs/CAPACITOR_SHELL_PREP.md`, `docs/STAGE_189_CAPACITOR_INTEGRATION_PLAN.md`, `mobile/android-twa/RELEASE.md`.

---

## 5. Новые страны / multi-jurisdiction

| Тема | Сейчас | Backlog |
|------|--------|---------|
| Учёт | THB-centric ledger; RU/KG split в pricing snapshot / FI | Не plug-and-play |
| Гость платит | RUB MIR + crypto paths + display FX | Расширение PSP под юрисдикцию |
| Партнёр получает | RUB Direct, KG crypto scaffolding (ADR-097) | Новые payout rails |
| Compliance | KG IT summary, compliance CSV | Полная multi-jurisdiction legal matrix |
| Страна #2 | — | **Сначала ADR** «что нужно для новой юрисдикции» (pricing profile, payout, fiscal, legal, FX) — **не код** |

Амбиция «международный агрегатор»: сначала безупречный контур **THB + RU Concierge**, затем документированное расширение.

См. `docs/archive/reports/PHASE_D_CLOSURE_AND_ROADMAP.md` §3.4 / §4.2 #11 / §5.

---

## 6. Product / UX backlog (из паспорта и аудитов)

| Тема | Примечание |
|------|------------|
| Wave H mobile retention | `docs/WAVE_H_MOBILE_RETENTION.md`; backlog SSOT также `CRO_FUNNEL_CLOSURE_191` + `AUDIT_PARTNER_CABINET_MOBILE` |
| Soft back / optimistic nav | Частично shipped (200.13–200.17); дальнейший polish по ощущениям |
| Partner cabinet mobile | Аудит `AUDIT_PARTNER_CABINET_MOBILE` — residual items |
| Listing quality & conversion | Publish checklist, search ranking — post first live cohort |
| Partner Insights (analytics) | **Отдельный этап после PMF:** funnel (показ→просмотр→запрос→бронь), период, по объектам; сейчас — Обзор (деньги/занятость/репутация) + views на карточке листинга |
| Dispute / support loop | **Phase 1 done (200.137):** profile Help + product feedback → TG/email. Phase 2: DB queue + admin list; booking disputes stay in chat escalate |
| Design system UI-1+ | Component hex cleanup, partner `teal-*`, FinTech inline styles |
| Referral 2.0 «Phase E» | Digest Excel, side-by-side campaigns — **только по боли владельца** |
| Mobile apps (store) | Web-first до PMF; Cap — shell над web |
| AI listing generation at scale | Вторично к trust & payments |
| Discovery / location roadmap | `docs/LOCATION_DISCOVERY_ROADMAP.md` |
| **Keyword + semantic («ИИ») search UI** | **Hidden at launch (201.80).** SSOT: `lib/search/catalog-keyword-search-ui.js`. Revisit when **≳1000** active listings + dense geos: flip flag, admin `semanticSearchOnSite`, geo-aware ranking / newer embeddings. Backend `q`+embeddings kept. |
| **Where / «Куда?» discovery** | **Supply-first (201.82).** Popular chips = inventory > 0 only; guest empty list = «Везде» (no Phuket district dump). Labels via `resolve-where-display-label.js`. Next: ops curation of popular seed vs live markets; district suggest only under city. |

---

## 7. Technical debt (месяц 2–3)

| Задача | Приоритет |
|--------|-----------|
| Partner listing Restore | **Done (200.128)** — `POST …/restore`, trash filter, iCal `auto_sync_before_soft_delete` |
| Split fat `reporting.service` (funnel → module) | P2 |
| API integration tests — top 20 financial routes | P2 |
| ROI/FI cache invalidation completeness | P2 |
| Staging environment mirror | P2 |
| DB index review (referral_ledger, admin reports) | P2 |
| E2E: booking → pay (mock) → escrow → FI P&L | P2 |
| Financial SSOT audit page «кто пишет в ledger» | P1 |
| Worker tier (вынести длинные job с HTTP cron) | Отложено / средне |

---

## 8. Что не делать сейчас

- Новые marketing dashboards «ради полноты» после Phase D.
- Параллельная стройка multi-country до стабильного THB/RU.
- Cap Phase B до заполненного iOS PWA smoke + owner Phase A.
- Включение live Ambassador L2 без shadow-данных и caps.
- Автопулы выплат партнёрам без решения владельца (Concierge manual — launch default).

---

*Обновляйте этот файл при смене launch-приоритетов; закрытые пункты переносите в HISTORY или помечайте Done здесь.*

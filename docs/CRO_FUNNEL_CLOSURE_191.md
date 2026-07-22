# CRO Funnel Closure — Stage 191.1

> **Дата:** 2026-07-18 · **Скоуп:** guest funnel presentation smoke после Stages 190–191  
> **Метод:** code-truth + Playwright `cro-funnel-smoke` + accountant-math (цены)  
> **Не в скоупе:** mutation платежей / escrow / financial services

Связанный аудит: [`AUDIT_CONVERSION_CRO.md`](./AUDIT_CONVERSION_CRO.md).

---

## 1. Checklist пройденных сценариев

| # | Сценарий | Статус | Как проверено |
|---|----------|--------|---------------|
| 1 | Главная **mobile** → collapsed pill → search sheet | ✅ | `cro-funnel-smoke` + code `HomeHeroLuxe` |
| 2 | Sheet accordion Where/Dates/Guests **без nested drawers** | ✅ | `cro-funnel-smoke` (`sheet-wizard-where-trigger`, нет `where-combobox-trigger`) |
| 3 | Sheet close touch ≥44px | ✅ | P1-10 fix + e2e bounding box |
| 4 | Каталог **mobile** summary → sheet | ✅ | `cro-funnel-smoke` |
| 5 | Главная / каталог **desktop** search chrome | ✅ | code (md+ glass capsule / FilterBar) |
| 6 | PDP Instant vs Inquiry copy | ✅ | Stage 190.3 (`BookingPayTimingHint`) |
| 7 | PDP hero = **payable total** (+ fee-link mobile) | ✅ | 190.1 / 191.0 + `accountant-math` + cro PDP assert |
| 8 | PDP reviews выше + category scores | ✅ | Stage 191.0 |
| 9 | Mid-flow login **draft restore** | ✅ | Stage 190.5 (`gostaylo_booking_modal_draft`) |
| 10 | Inquiry / Instant booking create path | ✅ | `guest-inquiry-golden-path` (existing; not re-run every smoke) |
| 11 | Checkout Access Denied → **Login** + redirect | ✅ | Stage 190.4 + `cro-funnel-smoke` mock |
| 12 | Checkout thumb + Back → listing | ✅ | Stage 191.0 + `cro-funnel-smoke` mock |
| 13 | AWAITING_PAYMENT → Pay с PDP (`payHref`) | ✅ | Stage 190.2 wiring (code) |
| 14 | Draft filters «Показать N» | ✅ | Stage 190.6 |
| 15 | Accountant hero = payable (vehicles + housing) | ✅ | `accountant-math` (190.6b) |

**Ограничение smoke:** полный Instant/Inquiry create + real card capture **не** гонялись в 191.1 (запрет трогать payment/escrow). Используются существующие golden/mock проекты при полном CI.

---

## 2. Оставшиеся friction (после 190–191)

| ID | Severity | Friction | Файлы |
|----|----------|----------|-------|
| F1 | M | Нет TimeSelect на **hero desktop** для transport | `UnifiedSearchBar.jsx` hero |
| F2 | M | Guests всегда видны для vehicles; extras не сбрасываются при смене category | `UnifiedSearchBar`, `use-public-search-filters` |
| F3 | M | Phone всё ещё `required` в BookingModal | `BookingModal.jsx` |
| F4 | M | Нет hold/expiry countdown на checkout UI | `PaymentMethods.jsx`, `payment-window-policy.js` |
| F5 | S | BentoGallery: серые плейсхолдеры при 1 фото | `BentoGallery.jsx` |
| F6 | S | После scroll: FAB + pill оба ведут в одну sheet (дубль entry) | `PlatformHomeContent`, `MobileSearchFAB` |
| F7 | S | «Все фильтры» всё ещё вторая шторка поверх search sheet | `SearchFiltersShell` Drawer |
| F8 | M | Currency в URL не shareable (LS only) | currency context / listings URL |
| F9 | S | Sheet Where accordion: Playwright page-viewport click часто «outside viewport» (overflow scrollport + sticky footer) | `CatalogMobileSearchSheet`, `UnifiedSearchBar` |
| F10 | S | Broken/null listing thumbs → Next Image noise в e2e logs (`/_storage/... received null`) | storage / image pipeline |

---

## 3. Рекомендации P2

1. **Checkout hold timer** (MM:SS) — снизить abandoned pay.
2. **Hide Guests for transport** + reset times при смене категории.
3. **Hero TimeSelect** при `transportIntervalMode`.
4. **Phone optional** в booking form (email из профиля).
5. **BentoGallery** full-bleed при одном фото.
6. Flexible dates ±1/±3; recent searches chips на HOME.
7. Urgency badges («Only X left») где есть shared capacity.
8. Email «complete payment» для AWAITING_PAYMENT.
9. Shareable currency в query (осторожно с SEO).
10. Свести FAB/pill copy к одному sticky search chrome после scroll.
11. **Sheet UX:** гарантировать Where/Dates в первом экране scrollport (меньше clip sticky footer) — улучшит и touch, и e2e.
12. Harden null `cover_image` / storage 404 на PDP hero thumbs.

---

## 4. E2E

| Проект | Файл | Назначение |
|--------|------|------------|
| `cro-funnel-smoke` | `tests/e2e/cro-funnel-smoke.spec.ts` | Presentation funnel (191.1) |
| `accountant-bot` | `tests/e2e/bots/accountant-math.spec.ts` | Payable math |
| `guest-inquiry-golden-path` | existing | Inquiry → PAID_ESCROW (CI) |
| `checkout-mock-smoke` | existing | CARD/CRYPTO UI mock (не DB escrow) |

Запуск: `npx playwright test --project=cro-funnel-smoke`

---

## 5. Итог

P0/P1 критичные для CRO (цена, auth resume, payHref, access-denied Login, mobile search, home pill, reviews, checkout thumb) **закрыты**.  
Остаток — P2 vertical/search polish + urgency timer + gallery. Платежное ядро не менялось.

**Прогон 191.1 (2026-07-18):**
- `npx playwright test --project=cro-funnel-smoke` → **5 passed**
- `npm run build` → **exit 0**

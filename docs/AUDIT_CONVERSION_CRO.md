# Аудит конверсии гостевой воронки (CRO)

> **Версия:** 1.0 · **Дата:** 2026-07-18 · **Роль:** UX Research + CPO  
> **Скоуп:** Главная → `/listings` → `/listings/[id]` → `/checkout/[bookingId]` → успех/ошибка оплаты  
> **Метод:** code-truth + UI-компоненты (без изменений кода). Норматив по деньгам/броням — `ARCHITECTURAL_DECISIONS.md`, поток — `docs/PRODUCT_FLOW_MAP.md`.  
> **Бенчмарки:** Airbnb (search pill, sticky Reserve, transparent price), Booking.com (urgency, review trust, resume unpaid).

---

## 1. Карта воронки (SSOT-файлы)

```
Главная                    Каталог                 PDP                      Checkout
────────                   ───────                 ───                      ────────
HomeHeroLuxe               listings-catalog-client ListingPdpClient         checkout/[bookingId]/page
UnifiedSearchBar           CatalogSearchSummaryBar BookingWidget            PaymentMethods
CatalogMobileSearchSheet   SearchFiltersDialog     BookingPriceBreakdown    CheckoutSummary
use-platform-home-page     use-public-search-      useListingBookingFlow    useCheckoutPayment
                           filters                 GuestBookingNextSteps    CheckoutStateViews
```

Инфраструктура URL/фильтров сильная (`lib/search/listings-page-url.js`, `docs/SEARCH_FILTERS_QUERY_MAP.md`).  
Трение в основном в **UX-слое**, не в «дырявом» backend поиска.

---

## 2. Friction Map — топ-5 точек потери гостя

| # | Где спотыкается | Что происходит | Почему уходит | Код / UI |
|---|-----------------|----------------|---------------|----------|
| **1** | **PDP → оплата** | Instant-book: подсказка «Оплата после подтверждения хозяина»; логин **после** заполнения формы; поля перезаписываются профилем | Потеря доверия к цене/офферу + обрыв mid-form | `listingBookingPayHint` (`listings-public.js`), `BookingActionButtons.jsx`, `useListingBookingFlow.js`, `BookingModal.jsx` |
| **2** | **PDP цена** | Hero = subtotal + service fee **без налога**; breakdown/final — **с налогом**; copy обещает «налоги» | Сюрприз на checkout / ощущение «накрутили» | `getPdpHeroGuestPriceThb` (`guest-display-price.js`), `BookingWidget.jsx`, `BookingPriceBreakdown.jsx` |
| **3** | **Checkout без сессии** | Access denied: только Home + Refresh, **нет Login** с return URL | Гость с письмом/закладкой не может дожать оплату | `CheckoutAccessDeniedView` (`CheckoutStateViews.jsx`), `page.js` |
| **4** | **Каталог mobile** | Nested drawers (шторка → календарь/куда/гости/фильтры); CTA «Показать N» на **уже загруженной** выдаче, не на draft | Усталость жестов; неверный count → недоверие к Apply | `CatalogMobileSearchSheet.jsx`, `SearchFiltersDialog.jsx`, `search-calendar.jsx` |
| **5** | **Главная mobile** | Полная капсула полей (chips + Where + Dates + Guests + Find); транспорт **без времени** на hero; FAB дублирует тот же поиск | Overload first paint; vehicles с дефолтом 07:00 | `HomeHeroLuxe.jsx`, `UnifiedSearchBar.jsx`, `CatalogMobileSearchSheet.jsx` |

**Дополнительный разрыв recovery (почти P0):** на PDP после заявки `GuestBookingNextStepsCard` часто **без `payHref`** при `AWAITING_PAYMENT` — нет явного «Оплатить», хотя компонент это умеет (`GuestBookingNextStepsCard.jsx`, wiring в `ListingPdpClient.jsx`). В чате `payHref` уже есть.

---

## 3. Этапы воронки — детальный разбор

### 3.1 Главная (точка входа)

| Вопрос | Оценка | Находка |
|--------|--------|---------|
| Понятна ли форма на mobile? | Слабо | Все поля сразу; нет Airbnb-pill «Куда · даты · гости» |
| Даты / категория «в один тап»? | Частично | Category chips ок; даты → nested drawer в FAB-пути |
| Лишние поля? | Да | Guests всегда; Time для transport только в filter/FAB, не в hero |
| Дубли CTA? | Да | Hero search + sticky FAB |

**Сильные стороны:** единый `UnifiedSearchBar`, chips категорий, URL SSOT при уходе в каталог.

### 3.2 Каталог `/listings`

| Вопрос | Оценка | Находка |
|--------|--------|---------|
| Фильтры на телефоне? | Средне | Summary bar ок; внутри — матрёшка drawer’ов |
| Валюта / даты без потери фильтров? | Хорошо | Даты/where → `router.replace` с extras; валюта в LS (не shareable) |
| «Показать N» сразу и честно? | Плохо | Есть label, но `resultCount={allListings.length}` — не preview draft |

**Сильные стороны:** debounce URL, карта фильтров документирована, sticky summary.

### 3.3 PDP `/listings/[id]`

| Вопрос | Оценка | Находка |
|--------|--------|---------|
| Калькулятор цен прозрачен? | Средне− | Breakdown есть; hero может ≠ payable total |
| Разбивка сутки / сервис / налог? | Частично | Нет явного `$X × N nights`; tax при 0 скрыт, copy всё равно про налоги |
| Отзывы / галерея? | Слабо | Reviews низко + lazy; галерея с серыми плейсхолдерами при 1 фото |
| Sticky CTA? | Средне | Price + Book; без fee-link на mobile compact |

**Сильные стороны:** единый booking flow hooks, breakdown-компонент, next-steps card (недоиспользован).

### 3.4 Checkout `/checkout/[id]`

| Вопрос | Оценка | Находка |
|--------|--------|---------|
| Сколько шагов до карты? | Хорошо | Один экран: метод + promo + legal + Pay |
| Лишние поля? | Ок на checkout | Перегруз раньше — на PDP modal (phone required в UI при optional API) |
| Success / error? | Средне | Success/failed нормальные; access denied / unavailable без Login и без различия expired hold |
| Abandoned pay? | Слабо | Нет hold-timer UI; weak resume с PDP; нет Login returnTo |

**Сильные стороны:** короткий checkout, методы CARD/MIR/CRYPTO по гео, escape analytics.

---

## 4. Сравнение с Airbnb / Booking — чего нет, но легко взять

| Паттерн гигантов | У нас | Effort |
|------------------|-------|--------|
| Collapsed mobile search pill → sheet | Полная форма на hero | S |
| Sticky «Show N» с **live draft count** | Count от текущей выдачи | M |
| Flexible dates ±1/±3 | Нет | M |
| Цена hero = **payable total** + `$X × nights` | Расхождение tax / слабая строка базы | S |
| Login **до** формы или guest checkout + draft restore | Login mid-submit + overwrite | M |
| Access denied → **Log in** + return to checkout | Home + Refresh | S |
| Resume unpaid: CTA «Оплатить» + countdown | payHref часто не прокинут; нет timer | S–M |
| Reviews above-the-fold / category scores | Блок низко, без категорий | M |
| Urgency: «Only X left» / rare find | Partial (shared spots) | M |
| Checkout: thumb листинга + back to listing | Нет thumb; Back → `/` | S |
| Сохранение недописанного бронирования (draft) | Нет явного draft storage | M |

---

## 5. Пошаговый план улучшений

### P0 — критично для продаж

| # | Правка | Файлы | Ожидаемый эффект |
|---|--------|-------|------------------|
| P0-1 | Hero price = итого к оплате (с tax); честный fee-note | `lib/pricing/guest-display-price.js`, `BookingWidget.jsx`, `BookingPriceBreakdown.jsx` | Меньше sticker shock на checkout |
| P0-2 | Развести copy instant vs inquiry (`listingBookingPayHint`) | `lib/translations/listings-public.js`, `BookingActionButtons.jsx` | Доверие к Instant Book |
| P0-3 | Checkout access denied → Login + `redirect` на checkout | `CheckoutStateViews.jsx`, `checkout/.../page.js` / load hook | Возврат платящих с deep link |
| P0-4 | Auth gate **до** booking form ИЛИ persist draft полей после login | `useListingBookingFlow.js`, `BookingModal.jsx` | Меньше drop mid-form |
| P0-5 | Прокинуть `payHref` в `GuestBookingNextStepsCard` на PDP | `ListingPdpClient.jsx` | Дожим AWAITING_PAYMENT |
| P0-6 | Убрать nested drawers в catalog/home search sheet (inline / `wizardStep`) | `CatalogMobileSearchSheet.jsx`, `search-calendar.jsx`, `WhereCombobox.jsx`, `GuestsPopover.jsx` | ✅ Stage 190.6 accordion + wizardStep |
| P0-7 | Честный «Показать N» + draft/live count | `SearchFiltersDialog.jsx`, `listings-catalog-client.jsx` | ✅ Stage 190.6 `useDraftFilterResultCount` |

### P1 — желательно для удобства

| # | Правка | Файлы |
|---|--------|-------|
| P1-1 | Mobile HOME → collapsed pill | `HomeHeroLuxe.jsx`, `PlatformHomeContent.jsx` | ✅ Stage 191.0 |
| P1-2 | Time row для transport на hero | `UnifiedSearchBar.jsx`, `HomeHeroLuxe.jsx` |
| P1-3 | Скрыть Guests для vehicles; сброс vertical extras при смене category | `UnifiedSearchBar.jsx`, `use-public-search-filters.js` |
| P1-4 | Fee-link в mobile sticky bar; `$X × N` в breakdown | `BookingWidget.jsx`, `BookingPriceBreakdown.jsx` | ✅ Stage 191.0 (+190.1) |
| P1-5 | Phone optional / defer; email из профиля | `BookingModal.jsx` |
| P1-6 | Checkout: фото листинга, Back → listing/my-bookings, `Button variant="brand"` | `CheckoutSummary.jsx`, `PaymentMethods.jsx`, `page.js` | ✅ Stage 191.0 |
| P1-7 | Hold/expiry timer на checkout | `PaymentMethods.jsx`, `lib/booking/payment-window-policy.js` |
| P1-8 | Reviews выше + даты; gallery без серых плейсхолдеров | `ReviewsSection.jsx`, `BentoGallery.jsx` | ✅ Stage 191.0 (reviews+scores; gallery deferred) |
| P1-9 | Flow hint без обязательного Chat для instant | `GuestBookingFlowHint.jsx` |
| P1-10 | Touch ≥44px на close sheet | `CatalogMobileSearchSheet.jsx` | ✅ Stage 191.1 |

### P2 — рост / дифференциация

- Flexible dates, recent searches chips на HOME, urgency badges, currency в shareable URL (осторожно с SEO), guest draft booking localStorage, email «complete payment».
- Closure checklist + remaining friction: **`docs/CRO_FUNNEL_CLOSURE_191.md`** (Stage 191.1).

---

## 6. Замечания архитектора (SSOT / product)

1. **Цена гостя должна иметь один SSOT-геттер** для hero, sticky, modal и checkout preview. Сейчас `getPdpHeroGuestPriceThb` и breakdown расходятся — классический источник churn.
2. **Pay-path recovery** уже частично есть в чате (`BookingInfoSidebar` + `payHref`) — PDP должен использовать тот же контракт (`GuestBookingNextStepsCard`), не изобретать второй.
3. **Auth mid-funnel** — антипаттерн Airbnb/Uber; либо soft gate с preview, либо login-first с restore draft. Overwrite полей после login — прямой bug конверсии.
4. **Search:** URL-слой зрелый; не ломать `listings-page-url` / ADR-101 при UX-полировке — править presentation (inline calendar уже заложен как `wizardStep`).
5. **Не путать Super-App термины** в copy: «хозяин» в pay-hint для всех вертикалей — уже частично через `{providerPossessive}`, но смысл «после подтверждения» вреден для Instant.

---

## 7. Метрики успеха (после внедрения P0)

| Метрика | Зачем |
|---------|--------|
| PDP → booking create rate | Auth + form friction |
| Booking created → checkout open | payHref / next steps |
| Checkout open → payment success | Access denied, trust, methods |
| Filter sheet Apply rate | Nested drawers + Show N |
| Home search → listings with dates | Hero overload / transport times |

Инструмент: существующий `trackProductEvent` / product analytics (не плодить параллельные счётчики).

---

## 8. Итог

Воронка **технически живая** (поиск URL-SSOT, короткий checkout, breakdown-компонент).  
Конверсия режется **доверием к цене**, **auth mid-flow**, **оплатным dead-end без Login**, **mobile search chrome** и **недожатым resume unpaid**.

Приоритет спринта: **P0-1…P0-5** (деньги + auth + resume), затем **P0-6…P0-7** (mobile search), затем P1 polish.

*Документ — анализ; код не менялся. Следующий шаг — тикеты P0 с владельцем продукта.*

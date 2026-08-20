# Промпт для Cursor: Stage 131.A5.B2 — Калькулятор v2

> **Это промпт-задание для Cursor'а. Скопируйте содержимое секции `## PROMPT` ниже и отправьте в Cursor.**

---

## PROMPT

```
TASK: Реализуй Stage 131.A5.B2 — редизайн калькулятора реферальной программы (Variant B + 4 дополнения).

CONTEXT
=======
Airento — универсальный агрегатор (недвижимость, транспорт, услуги, аренда яхт).
В калькуляторе реферальной программы сейчас плохое UX:
  - 42%/10%/5%/43% в одной строке → пользователь думает, что это % от чека
  - "Кешбэк гостю" больше, чем доход L1, и это сбивает с толку
  - L2/L3 выглядят как "ещё % от тех же 5 заказов", хотя это другая сеть
  - Нет L3 placeholder, хотя L3 gate = 10+ прямых партнёров
  - Нет L2 caps (500 THB/заказ, 50K THB/мес)
  - Нет слайдера "Активность L1" — hardcoded 33% в коде

ПОЛНАЯ СПЕЦИФИКАЦИЯ ТЕКСТОВ
==========================
Прочитай `docs/specs/referral-calculator-copy-v2.md` — там 4 языка (RU/EN/ZH/TH),
все i18n-ключи, формулировки для простого и подробного режимов, L3 placeholder,
L2 caps, disclaimer, FX-подсказка.

ОБЯЗАТЕЛЬНО К ПРОЧТЕНИЮ
========================
1. `docs/specs/referral-calculator-copy-v2.md` — спецификация текстов (прочитай целиком)
2. `lib/services/marketing/referral-public-calculator.service.js` — формула расчёта (НЕ ТРОГАТЬ!)
3. `app/api/v2/referral/calculator/route.js` — API endpoint (НЕ ТРОГАТЬ)
4. `components/about/ReferralCalculatorClient.jsx` — публичный калькулятор (ОСНОВНОЙ ФАЙЛ)
5. `components/referral/ReferralProfilePage.jsx` — inline-калькулятор в кабинете (ТОЖЕ МЕНЯТЬ)
6. `lib/translations/slices/profile-app-referral.js` — i18n ключи (добавить 4 языка)
7. `lib/translations/slices/partner-shell.js` — проверить, есть ли уже похожие ключи

ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ
====================
A. `components/about/ReferralCalculatorClient.jsx` — основной калькулятор
B. `components/referral/ReferralProfilePage.jsx` — inline-калькулятор в hero кабинета
C. `lib/translations/slices/profile-app-referral.js` — i18n ключи
D. `lib/translations/slices/partner-shell.js` — если есть старые ключи про "поездку/бронь"
E. Новые тесты: `__tests__/stage131-a5-b2-calculator.test.js`

ФАЙЛЫ, КОТОРЫЕ НЕ ТРОГАТЬ
=========================
- `lib/services/marketing/referral-public-calculator.service.js`
- `app/api/v2/referral/calculator/route.js`
- `lib/services/finance/fintech-waterfall.js`
- `lib/services/marketing/referral-policy.service.js`
- `lib/config/fintech-config-defaults.js`

Если думаешь, что нужно менять эти файлы — СТОП, спроси сначала.

ЧТО ИМЕННО ДЕЛАТЬ
=================

### 1. Новый параметр `l1ActivityRate` в API (если ещё нет)

В `app/api/v2/referral/calculator/route.js`:
- Принимать `l1ActivityRate` (0..1, default 1/3)
- Пробросить в `computePublicReferralCalculatorEstimate`
- Если параметр уже есть — не дублировать

### 2. Изменить `referral-public-calculator.service.js`

- Использовать `l1ActivityRate` для расчёта L2 (и L3² для L3)
- Добавить возврат `l3Locked: boolean` — true если в `system_fintech_settings` 
  `directPartnersInvited < 10` ИЛИ `ambassadorGuestL3Enabled === false`
- Добавить возврат `l2CapPerBookingThb`, `l2CapPerMonthThb` (уже есть в config)
- НЕ менять split логику, НЕ менять формулу referralPool

### 3. Полностью переписать `ReferralCalculatorClient.jsx`

ДВА РЕЖИМА с переключателем "Простой" (default) ↔ "Подробный":

**Простой режим:**
- 3 слайдера в ряд (или столбец на мобиле):
  - "Сколько заказов сделают ваши приглашённые" (1-50, default 5)
  - "Средняя сумма заказа" (1 000 - 500 000 в display валюте, default 29 000)
  - "Насколько активны ваши L1" (0% / 33% / 66% / 100%, default 33%) — НОВЫЙ СЛАЙДЕР
- Одна большая карточка:
  - Заголовок: "Вы примерно заработаете"
  - Крупно: итоговая сумма
  - Мелко: "Прямые (L1): X" + "Сеть (L2): Y" (БЕЗ L3 если locked)
  - Если L3 locked — placeholder: "L3 пока недоступен — нужно 10+ прямых партнёров, у вас X/10"
- Кнопки:
  - "Как считается?" → раскрывает подробный режим
  - "Что получает клиент?" → раскрывает блок про cashback
- Disclaimer мелко: "Оценка до холда 14 дней. Точная сумма по каждому заказу."
- FX-подсказка: "Суммы в {валюта} по курсу THB/{валюта} {rate} (mid)."

**Подробный режим (по клику "Как считается?"):**
- Воронка одного заказа (4 шага):
  1. Клиент платит: X ₽
  2. Маржа платформы: Y ₽
  3. Реферальный пул (45% маржи): Z ₽
  4. Пул делится так:
     - L1 (42%): X ₽
     - L2 (10%, cap 500 THB/заказ, 50 000 THB/мес): Y ₽
     - L3 (5%, нужен gate 10+ партнёров) ИЛИ placeholder: "без выплат — у вас X/10"
     - Cashback клиенту (43%): W ₽
- Слайдер активности (тот же, что в простом)
- Расчёт на N заказов:
  - L1 × N = итого
  - L2 × N × activity = итого
  - L3 × N × activity² = итого (или placeholder)
- Итог: "Всего вам примерно: X ₽"
- Кнопка "Свернуть"

**Блок "Что получает клиент?":**
- Заголовок: "Что получает приглашённый клиент"
- Текст (RU/EN/ZH/TH из макета)
- Пример с цифрами

### 4. Изменить inline-калькулятор в `ReferralProfilePage.jsx`

- Найти блок "Калькулятор в кабинете" (внутри hero/Пригласить)
- Применить ТОТ ЖЕ макет — простой режим + кнопка "Как считается?"
- Использовать `useReferralPublicCalculator` или прямой fetch к /api/v2/referral/calculator
- НЕ дублировать логику — вынести в общий компонент, если возможно

### 5. i18n ключи

Добавить ВСЕ ключи из `docs/specs/referral-calculator-copy-v2.md` в
`lib/translations/slices/profile-app-referral.js`:
- `calc_simple_title`, `calc_simple_subtitle`
- `calc_slider1_label`, `calc_slider2_label`, `calc_slider3_label`
- `calc_slider3_help`
- `calc_result_title`, `calc_result_l1_label`, `calc_result_network_label`, `calc_result_total_label`
- `calc_l3_locked_title`, `calc_l3_locked_body`
- `calc_btn_how`, `calc_btn_guest`, `calc_btn_close`
- `calc_disclaimer`, `calc_fx_note`
- `calc_detail_title`, `calc_step1`, `calc_step1_hint`, `calc_step2`, `calc_step3`, `calc_step4`
- `calc_split_l1`, `calc_split_l2`, `calc_split_l3`, `calc_split_l3_locked`, `calc_split_referee`
- `calc_total_l1`, `calc_total_l2`, `calc_total_l3`
- `calc_total_title`, `calc_total_note`
- `calc_guest_title`, `calc_guest_body`, `calc_guest_example`

Все 4 языка. Если в `partner-shell.js` есть старые ключи про "поездку" — заменить.

### 6. УНИВЕРСАЛЬНАЯ ТЕРМИНОЛОГИЯ

В новых i18n ключах и в UI-текстах:
- "заказ" — вместо "поездка", "бронь", "бронирование"
- "клиент" — вместо "гость", "путешественник", "турист"
- "приглашённый" — вместо "друг"
- "средняя сумма заказа" — вместо "средний чек"

В существующих i18n-ключах, которые НЕ относятся к калькулятору, 
замену НЕ делать (это другая задача, не в этом этапе).

ИСКЛЮЧЕНИЕ: "Cashback клиенту" — термин "cashback" универсален.

### 7. Тесты

Создай `__tests__/stage131-a5-b2-calculator.test.js`:
- Простой режим показывает ОДНУ цифру, не разбивку
- L3 placeholder при <10 партнёров
- L2 caps указаны в подробном режиме
- "Поездка/бронь/жильё/путешественник" НЕ встречаются в новом UI
- i18n ключи работают для 4 языков
- Слайдер активности обновляет расчёт
- FX-подсказка показывается

Coverage для нового компонента — не менее 80%.

### 8. Build & tests

- `npm run build` — должен пройти
- `npm run lint` — без новых ошибок
- Существующие тесты калькулятора (`stage131-a5-*`) — обновить/дополнить
- Новые тесты `stage131-a5-b2-calculator` — все зелёные

### 9. Commit

После всех правок — один коммит с message:
```
fix(referral): Stage 131.A5.B2 — калькулятор v2 (Variant B + 4 дополнения)

- Простой режим: одна цифра, без процентов 42/10/5/43
- Слайдер "Активность L1" (0/33/66/100%)
- L3 placeholder при <10 прямых партнёров
- L2 caps (500/50K) в подробном режиме
- Универсальная терминология (заказ/клиент/приглашённый)
- 4 языка i18n (RU/EN/ZH/TH)
- FX-подсказка внизу
- Тесты stage131-a5-b2-calculator
```

### 10. После Cursor'а

НЕ пушить в origin самому. Показать diff + результаты тестов владельцу.
Ждать одобрения перед push.

---

ГОТОВО. Если что-то непонятно — спроси. Не менять SSOT-файлы
(`referral-public-calculator.service.js`, формулу, API) без явного
согласования — там уже всё правильно по ADR.
```

---

## Комментарий к промпту (для владельца)

**Что входит в работу Cursor'а:**
- 1 новый параметр API (`l1ActivityRate`)
- 1 переписанный публичный калькулятор (`ReferralCalculatorClient.jsx`)
- 1 обновлённый inline-калькулятор (`ReferralProfilePage.jsx`)
- ~25 i18n-ключей × 4 языка
- 1 новый файл тестов
- 1 коммит

**Что Cursor НЕ должен трогать (но может попробовать):**
- `referral-public-calculator.service.js` (формула, split, waterfall) — это SSOT
- API route `/api/v2/referral/calculator/route.js` — только проброс параметра
- `fintech-config-defaults.js` — там всё правильно

**Где может споткнуться:**
- Слайдер «Активность L1» — в API пока нет параметра, нужно добавить
- L3 placeholder — нужно знать `directPartnersInvited` пользователя (из `/api/v2/referral/me`)
- FX-подсказка — нужно подтянуть текущий курс из `fx-display.js`

**Время оценки:** 2-3 часа Cursor'а (компонент + i18n + тесты + build).

---

*Pavel, промпт готов. Можно копировать секцию `## PROMPT` и отправлять в Cursor. Файлы:*
- *Спецификация текстов: `docs/specs/referral-calculator-copy-v2.md`*
- *Сам промпт: `docs/specs/referral-calculator-v2-prompt.md`*

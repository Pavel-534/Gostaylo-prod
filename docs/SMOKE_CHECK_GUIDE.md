# Smoke Check Guide (Stage 84.x)

Этот чеклист нужен владельцу перед включением/после включения атомарного контракта оплаты.

## 0) Подготовка

- Убедитесь, что применена миграция `migrations/stage84_0_atomic_escrow_ledger_contract.sql`.
- Убедитесь, что сервер запущен на актуальном коде.
- Подготовьте 2 аккаунта:
  - обычный пользователь (`USER`);
  - админ (`ADMIN`).
- В админке убедитесь, что есть минимум 1 активное объявление и можно создать бронь.

---

## 1) Security Guard (Admin API)

Цель: обычный пользователь не должен иметь доступ к admin API.

### Шаги

1. Войдите как обычный пользователь.
2. Откройте в браузере один из admin API:
   - `/api/v2/admin/stats`
   - `/api/v2/admin/partners`
   - `/api/v2/admin/health`
3. Повторите те же URL под админом.

### Ожидание

- Под `USER`: `401` или `403` (JSON с `success: false`).
- Под `ADMIN`: `200` и корректный JSON-ответ.

### Что это подтверждает

- Все `app/api/v2/admin/**` проходят через `requireAccess({ roles: ['ADMIN'] })`.
- Проверка роли/ban выполняется через БД, а не только по JWT claims.

---

## 2) Search Bypass (Hidden Category)

Цель: скрытая категория не должна открываться ручным `?category=...` для обычного пользователя.

### Подготовка категории

1. В админке (`/admin/categories`) выберите категорию, например `vehicles`.
2. Установите:
   - `is_active = false` **или**
   - `is_preview_only = true`.

### Шаги проверки

1. Под `USER` откройте:
   - `/api/v2/listings/search?category=vehicles`
2. Под `ADMIN` откройте тот же URL.

### Ожидание

- Под `USER`: `success: true`, но `data.listings = []`.
- Под `ADMIN`: категория доступна, выдача возвращается по фактическим данным.

### Что это подтверждает

- Анти-bypass логика в `app/api/v2/listings/search/route.js` работает и не позволяет обойти visibility-флаги через URL.

---

## 3) Payment Atomic (MOCK сценарий)

Цель: проверить, что при подтверждении платежа статус брони и ledger-проводки фиксируются атомарно.

### Шаги

1. Создайте тестовую бронь и дойдите до чекаута.
2. Вызовите initiate платежа (через UI/checkout), получите `Payment Intent`.
3. Проверьте, что в ответе присутствует:
   - `isTestMode: true` (для mock/fallback пути).
4. Подтвердите платеж (UI или API confirm).
5. Проверьте в БД:
   - `bookings.status = 'PAID_ESCROW'`;
   - есть `ledger_journals` с `event_type = 'BOOKING_PAYMENT_CAPTURED'` и `booking_id` этой брони;
   - есть связанные `ledger_entries` по `journal_id`;
   - сумма DEBIT = сумма CREDIT.
6. Проверьте серверные логи:
   - `⚠️ ВНИМАНИЕ: Проведен тестовый платеж (MOCK_MODE) для брони [ID]`.

### SQL-проверки (пример)

```sql
-- 1) Статус брони
select id, status, updated_at
from public.bookings
where id = '<BOOKING_ID>';

-- 2) Журнал
select id, booking_id, event_type, idempotency_key, created_at
from public.ledger_journals
where booking_id = '<BOOKING_ID>'
order by created_at desc
limit 5;

-- 3) Проводки
select journal_id, side, amount_thb, account_id
from public.ledger_entries
where journal_id = '<JOURNAL_ID>';

-- 4) Баланс журнала (должно быть 0)
select
  round(sum(case when side='DEBIT' then amount_thb else 0 end)::numeric, 2) as debit_sum,
  round(sum(case when side='CREDIT' then amount_thb else 0 end)::numeric, 2) as credit_sum,
  round(
    sum(case when side='DEBIT' then amount_thb else 0 end)::numeric -
    sum(case when side='CREDIT' then amount_thb else 0 end)::numeric
  , 2) as delta
from public.ledger_entries
where journal_id = '<JOURNAL_ID>';
```

### Что это подтверждает

- RPC `move_to_escrow_and_post_ledger_v1` выполняет atomic path для confirm.
- MOCK путь остается рабочим, но прозрачно помечается как тестовый.

---

## 4) UI-проверка test indicator

1. Откройте `/admin/finances`.
2. Найдите тестовый платеж после MOCK-checkout.

Ожидание:
- строка платежа визуально выделена как тестовая (бейдж `ТЕСТ`/серый стиль);
- в модалке деталей платежа также видно `ТЕСТ`.

Это нужно, чтобы владелец не путал реальные деньги и тестовые прогоны.

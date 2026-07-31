# Stage 103 — Pre-Launch Checklist (soft launch, первые 50–100 броней)

**Для кого:** владелец бизнеса / финансовый оператор (без программирования).  
**Режим:** Concierge Launch — деньги учитывает платформа, **переводы партнёрам делаете вы вручную**.

Связанные документы:

| Документ | Зачем |
|----------|--------|
| `docs/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md` | Ежедневные действия и §12 «Перед первой реальной выплатой» |
| `docs/PRE_LAUNCH_CHECKLIST.md` | Инфраструктура, cron, fiscal |
| `npm run smoke:full-financial` | Автоматическая проверка всей цепочки в БД |

---

## A. Один раз перед первым live-гостем

| ✓ | Действие | Где |
|---|----------|-----|
| ☐ | Cron и env: `npm run smoke:financial` → **PASS** | Терминал / DevOps |
| ☐ | Миграции escrow RPC в Supabase SQL Editor: `stage103_escrow_rpc_status_fix.sql`, затем `stage103_1_escrow_rpc_journal_id_ambiguous.sql` | DevOps (один раз) |
| ☐ | Полный финансовый smoke: `npm run smoke:full-financial` → все шаги ✅ | Терминал (нужен `.env.local` с Supabase) |
| ☐ | На staging: тестовый акт PDF открывается | `/admin/settings/legal` → «Сгенерировать тестовый акт» |
| ☐ | Версии оферты опубликованы (гость + партнёр) | `/admin/settings/legal` |
| ☐ | Финансовый пульт открывается, карточки «Готово к выплате» / «Последний пакет» | `/admin/settings/finances` |
| ☐ | `FISCAL_SANDBOX=false` на prod (если пробиваете live-чеки) | FinTech-пульт |
| ☐ | Telegram FINANCE приходит при закрытии пула (тест на staging) | Ваш бот / топик |

---

## B. На каждую оплату гостя (первые недели)

| ✓ | Проверка |
|---|----------|
| ☐ | Бронь → **PAID_ESCROW** (в админке или `/admin/bookings`) |
| ☐ | Чек fiscal: **ISSUED** или осознанный **PENDING** с повтором |
| ☐ | Нет открытого спора по брони |

---

## C. Перед выплатой партнёру (пул)

| ✓ | Шаг | Подсказка |
|---|-----|-----------|
| ☐ | Бронь **READY_FOR_PAYOUT** (≥24 ч после thaw) | Партнёр видит в «Доступно» |
| ☐ | Сформировать пул | FinTech → вкладка **Пулы** |
| ☐ | **Lock** пула | Без Lock — нельзя закрыть |
| ☐ | Скачать **CSV** и **Пакет для банка (ZIP)** | Строка пула в списке |
| ☐ | Перевести деньги в банке / USDT | Вручную, по суммам из CSV |
| ☐ | **Закрыть пул** (SETTLED) | Создаются PDF-акты партнёрам |
| ☐ | Партнёр видит акт | `/partner/finances` → вкладка **Документы** |
| ☐ | Сверка маржи / конвертаций при обмене валют | FinTech → «Конвертации и потери» |

---

## D. После первой **реальной** выплаты (деньги ушли)

| ✓ | Действие |
|---|----------|
| ☐ | Архив: CSV + ZIP + скрин/выписка банка в папке бухгалтерии |
| ☐ | Партнёр скачал акт (или переслали ссылку из кабинета) |
| ☐ | В журнале ledger нет drift (FinTech → сверка) |
| ☐ | Записана конвертация RUB→USDT/KGS, если был обмен |

---

## E. Команды для разработчика (копировать)

```bash
# Быстрый cron + engine-config
npm run smoke:financial

# Полная цепочка: гость → escrow → пул → акты → ZIP
npm run smoke:full-financial

# Через HTTP (dev-сервер + cookie админа)
GOSTAYLO_SESSION_COOKIE="..." npm run smoke:full-financial -- --http
```

Тестовые данные помечены `[E2E_TEST_DATA] stage103-financial-smoke`. Очистка: `npm run cleanup:test-data` (dry-run) / `cleanup:test-data:execute`.

---

## F. Если что-то красное

| Симптом | Что делать |
|---------|------------|
| Smoke ❌ на escrow | Проверить webhook / `EscrowService`, миграции ledger |
| Нет PDF после закрытия пула | Storage bucket `payout-documents`, логи `markBatchSettled` |
| Партнёр не видит акт | Вкладка «Документы», API settlement-documents |
| ZIP пустой | Кнопка «Пакет для банка» только после SETTLED |
| Drift в сверке | Стоп новых оплат, compliance export, разбор с разработчиком |

---

*Stage 103 · 2026-05-19 · при изменении API/cron обновить `docs/CONCIERGE_LAUNCH_TREASURY_RUNBOOK.md` и `docs/TECHNICAL_MANIFESTO.md`.*

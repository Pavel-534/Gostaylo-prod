# Legacy / unused cron logic (архив)

Файлы здесь **не** являются активными Next.js routes. Они сохранены как справка после Stage 2.5 cleanup.

| Архив | Было |
|--------|------|
| `payouts-route.ARCHIVE.md` | `app/api/cron/payouts/route.js` — автоматический payout-cron (отключён с PR-#2). `POST` всегда отвечал **503**; `GET` давал диагностический JSON (legacy preview / ready list). |

**Актуальная модель:** разморозка **`POST /api/cron/escrow-thaw`**, выплаты партнёру — через Request Payout / админ-процессы.

Если понадобится снова вызывать диагностический `GET` как в старом `payouts`, лучше вынести логику в **admin-only** endpoint или скрипт, а не восстанавливать публичный cron-path.

# Stage 189.1 — результаты smoke на реальном iOS (iPhone 11 Pro)

**Статус: ЖДЁМ ВЛАДЕЛЬЦА** — замеров ещё нет (все строки TBD).  
**Чек-лист:** [`docs/PWA_IOS_REAL_DEVICE_SMOKE.md`](PWA_IOS_REAL_DEVICE_SMOKE.md)  
**После заполнения:** агент делает анализ Stage **189.2** + точечные фиксы (тайминги не выдумывать).

| Поле | Значение |
|------|----------|
| Дата | _заполнит владелец_ |
| Устройство | iPhone 11 Pro (A13) |
| iOS | _TBD_ |
| Origin | Staging HTTPS / prod |
| Сборка / commit | `main` (Stage 189.1 PWA) |
| Сеть | Wi‑Fi + 4G Пхукет |

## Матрица результатов (владелец)

| Проверка | Результат (pass/fail + тайминг) | Заметки |
|----------|----------------------------------|---------|
| Cold start standalone | ⏳ | Цель: каталог usable &lt; ~4 с на 4G |
| SW activated + controlling | ⏳ | Web Inspector → Service Workers |
| Soft kill → повторное открытие | ⏳ | Нет цикла reload |
| Home → Каталог → PDP → даты → checkout stub | ⏳ | Без реального списания |
| Фон 30 с → resume | ⏳ | Нет refetch-шторма; ожидать resume-лог `[Airento PWA 189]` |
| Safe areas | ⏳ | Home indicator vs nav/композер |
| Подтверждение в чате партнёра | ⏳ | Тред PENDING |
| Push (опционально) | ⏳ | У iOS PWA push часто ограничен |
| После деплоя — обновление SW | ⏳ | `updateViaCache: none` |

### Опционально: вставить снимок из Console

После холодного открытия в standalone: Safari Web Inspector → Console → скопировать объект `[Airento PWA 189]` (`stage: "189.1"`, есть `paint.fcpMs` + `swStatus`).

Также после 30 с в фоне → resume: скопировать строку события resume.

```
(вставить cold-start сюда)
```

```
(вставить resume сюда)
```

### Опционально: localStorage

```js
JSON.parse(localStorage.getItem('airento_pwa_perf_v1'))
JSON.parse(localStorage.getItem('airento_pwa_resume_v1'))
```

## Базовая линия кода (до замеров на устройстве)

| Пункт | Статус |
|-------|--------|
| Телеметрия cold + resume + FCP + SW status | ✅ 189.1 |
| iOS: изображения constrained без NIA | ✅ 189.0 |
| Горизонт календаря 90 дн. при constrained | ✅ 189.1 |
| SW skipWaiting до precache | ✅ 189.1 |
| Throttle обновления SW в standalone (30 мин) | ✅ 189.1 |
| Standalone: refetch focus/reconnect выключен | ✅ 171.32 / 189.0 |
| Композер `pb-safe-chat-composer` + standalone CSS | ✅ 189.1 |
| Playwright mobile-chat | ✅ 172 verification |

## Подпись

- Владелец: ________________  
- Гостевая установка на Пхукете прошла: ☐ Да ☐ Нет — блокеры: ________

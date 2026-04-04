# План ремонта системы отзывов и рейтингов

## Шаг 1: Загрузить SQL миграцию (ПОЛЬЗОВАТЕЛЬ)
Файл: `docs/history/sql/MIGRATION_RUN_THIS.sql`

1. Откройте Supabase Dashboard
2. Перейдите в SQL Editor
3. Скопируйте содержимое файла `docs/history/sql/MIGRATION_RUN_THIS.sql`
4. Запустите скрипт
5. Убедитесь что видите сообщение "✅ Migration complete!"

## Шаг 2: Проверить что миграция применилась (АГЕНТ)
После того как пользователь подтвердит успешное выполнение SQL:

```bash
# Проверить структуру таблицы reviews
curl "${SUPABASE_URL}/rest/v1/reviews?limit=0" -H "apikey: ${KEY}"

# Должны быть новые колонки:
# - rating_cleanliness
# - rating_accuracy  
# - rating_communication
# - rating_location
# - rating_value
```

## Шаг 3: Пересоздать тестовые отзывы с мультикатегориями (АГЕНТ)
```bash
# Удалить старые отзывы
DELETE FROM reviews WHERE id LIKE 'review-test-%'

# Создать новые через API POST с ratings объектом
curl -X POST /api/v2/reviews -d '{
  "userId": "...",
  "listingId": "...",
  "ratings": {
    "cleanliness": 5,
    "accuracy": 4,
    "communication": 5,
    "location": 5,
    "value": 4
  }
}'
```

## Шаг 4: Обновить рейтинг listings с decimal значениями (АГЕНТ)
```sql
UPDATE listings 
SET rating = 4.6, reviews_count = 2
WHERE id = 'lst-mmih84ji-6jolf';

UPDATE listings 
SET rating = 4.6, reviews_count = 1
WHERE id = 'lst-f2b62ebd';
```

## Шаг 5: Отладить отображение звезд (АГЕНТ)
1. Добавить console.log в GostayloListingCard:
   ```javascript
   console.log('Listing data:', { rating, reviews_count, displayRating })
   ```

2. Проверить API ответ listings:
   - Убедиться что возвращается `rating` и `reviews_count`
   
3. Если данные не приходят - обновить API endpoint для включения этих полей

## Шаг 6: Тестирование (АГЕНТ)
1. Перезапустить frontend
2. Открыть /listings страницу
3. Проверить Browser Console на наличие данных
4. Сделать screenshot с видимыми звездами
5. Проверить /renter/favorites
6. Проверить Review Modal submission

## Шаг 7: Финальный отчет (АГЕНТ)
- ✅ Миграция применена
- ✅ Звезды отображаются  
- ✅ Multi-category ratings работают
- ✅ Review submission успешен
- ✅ Privacy правила соблюдены

---

## Что делать АГЕНТУ после подтверждения пользователя:

1. Проверить что миграция применена (шаг 2)
2. Пересоздать тестовые отзывы с правильной структурой (шаг 3)
3. Обновить listings с decimal рейтингом (шаг 4)
4. Добавить debug logging в компонент (шаг 5)
5. Найти и исправить почему звезды не видны (шаг 5)
6. Протестировать все flow (шаг 6)
7. Предоставить финальный отчет со screenshots (шаг 7)

Время: ~20-30 минут работы агента

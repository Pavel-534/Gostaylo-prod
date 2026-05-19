# Stage 103.2 — применение по частям (если SQL Editor: connection timeout)

Выполняйте в Supabase → SQL Editor **по одному блоку**. После каждого — дождитесь **Success**.

## 1. payout_batches

```sql
ALTER TABLE public.payout_batches
  ADD COLUMN IF NOT EXISTS export_checksum TEXT;

ALTER TABLE public.payout_batches
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

ALTER TABLE public.payout_batches
  ADD COLUMN IF NOT EXISTS exported_at TIMESTAMPTZ;

ALTER TABLE public.payout_batches
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
```

## 2. payout_batch_items — updated_at

```sql
ALTER TABLE public.payout_batch_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.payout_batch_items
SET updated_at = COALESCE(created_at, now())
WHERE updated_at IS NULL;
```

## 3. payout_batch_items — прочие (без FK, быстрее)

```sql
ALTER TABLE public.payout_batch_items
  ADD COLUMN IF NOT EXISTS ledger_journal_id TEXT;

ALTER TABLE public.payout_batch_items
  ADD COLUMN IF NOT EXISTS payout_id TEXT;
```

Опционально FK (только если таблица `ledger_journals` есть и мало строк в items):

```sql
ALTER TABLE public.payout_batch_items
  DROP CONSTRAINT IF EXISTS payout_batch_items_ledger_journal_id_fkey;

ALTER TABLE public.payout_batch_items
  ADD CONSTRAINT payout_batch_items_ledger_journal_id_fkey
  FOREIGN KEY (ledger_journal_id) REFERENCES public.ledger_journals (id) ON DELETE SET NULL;
```

## 4. payouts

```sql
ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.payouts
SET updated_at = COALESCE(processed_at, created_at, now())
WHERE updated_at IS NULL;
```

## Проверка

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'payout_batches' AND column_name = 'locked_at')
    OR (table_name = 'payout_batch_items' AND column_name = 'updated_at')
    OR (table_name = 'payouts' AND column_name = 'updated_at')
  );
```

Должно вернуть **3 строки**.

-- Расширение enum для строк в exchange_rates (селектор валют в UI).
-- PostgreSQL 9.1+: ADD VALUE; на Supabase (PG15+) можно IF NOT EXISTS.

ALTER TYPE currency_type ADD VALUE IF NOT EXISTS 'EUR';
ALTER TYPE currency_type ADD VALUE IF NOT EXISTS 'GBP';
ALTER TYPE currency_type ADD VALUE IF NOT EXISTS 'CNY';

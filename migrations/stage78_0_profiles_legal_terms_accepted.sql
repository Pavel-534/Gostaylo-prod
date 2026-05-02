-- Юридическое согласие пользователя с публичной офертой и политикой конфиденциальности (регистрация / первый платёж).
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS legal_terms_accepted_at timestamptz NULL;

COMMENT ON COLUMN public.profiles.legal_terms_accepted_at IS
  'Отметка времени принятия Публичной оферты и Политики конфиденциальности (signup или checkout до оплаты).';

CREATE INDEX IF NOT EXISTS idx_profiles_legal_terms_accepted_at
  ON public.profiles (legal_terms_accepted_at DESC)
  WHERE legal_terms_accepted_at IS NOT NULL;

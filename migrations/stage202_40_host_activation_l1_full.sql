-- Stage 202.40 — Host activation: 100% L1 + pot 760 THB (RF mid ~₽2500 display)
-- Live SSOT: system_fintech_settings.id = 'global'
-- Guest pool / L2–L3 guest / referee / tier — unchanged.

UPDATE public.system_fintech_settings
SET
  mlm_level1_percent = 100,
  mlm_level2_percent = 0,
  partner_activation_bonus_thb = 760,
  updated_at = NOW()
WHERE id = 'global';

COMMENT ON COLUMN public.system_fintech_settings.partner_activation_bonus_thb IS
  'Host activation pot (THB) from promo tank; Stage 202.40 = 760 THB (~₽2500 RF mid display). Paid 100% to direct L1 referrer.';

COMMENT ON COLUMN public.system_fintech_settings.mlm_level1_percent IS
  'Host-activation L1 share of partner_activation_bonus_thb. Stage 202.40 = 100. Guest pool uses ambassador_guest_pool_* separately.';

COMMENT ON COLUMN public.system_fintech_settings.mlm_level2_percent IS
  'Host-activation L2 share. Stage 202.40 = 0 (no L2 on host activation). Guest L2 uses ambassador_guest_pool_l2_percent.';

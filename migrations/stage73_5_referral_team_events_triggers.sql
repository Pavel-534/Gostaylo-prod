-- Stage 73.5 — триггер на referral_relations для teammate_joined + индекс на чтение ленты.

-- SSOT событий «join» переносится в БД (идемпотентность через NOT EXISTS).

-- Сложные события (бонус, первая поездка, листинг) остаются в приложении (ReferralPnlService / moderation).



CREATE OR REPLACE FUNCTION public.trg_referral_relations_insert_team_joined()

RETURNS TRIGGER

LANGUAGE plpgsql

SECURITY DEFINER

SET search_path = public

AS $$

DECLARE

  v_fn text;

  v_ln text;

  v_meta jsonb;

BEGIN

  IF TG_OP <> 'INSERT' THEN

    RETURN NEW;

  END IF;



  IF EXISTS (

    SELECT 1

    FROM public.referral_team_events e

    WHERE e.referrer_id = NEW.referrer_id

      AND e.referee_id = NEW.referee_id

      AND e.event_type = 'teammate_joined'

  ) THEN

    RETURN NEW;

  END IF;



  SELECT p.first_name, p.last_name INTO v_fn, v_ln

  FROM public.profiles p

  WHERE p.id = NEW.referee_id;



  v_meta := COALESCE(NEW.metadata, '{}'::jsonb)

    || jsonb_build_object(

      'source', 'trigger_referral_relations',

      'displayName', NULLIF(trim(both ' ' FROM concat_ws(' ', v_fn, v_ln)), '')

    );



  INSERT INTO public.referral_team_events (referrer_id, event_type, referee_id, metadata, created_at)

  VALUES (

    NEW.referrer_id,

    'teammate_joined',

    NEW.referee_id,

    v_meta,

    COALESCE(NEW.referred_at::timestamptz, now())

  );



  RETURN NEW;

END;

$$;



DROP TRIGGER IF EXISTS trg_referral_relations_team_joined ON public.referral_relations;



CREATE TRIGGER trg_referral_relations_team_joined

  AFTER INSERT ON public.referral_relations

  FOR EACH ROW

  EXECUTE FUNCTION public.trg_referral_relations_insert_team_joined();



COMMENT ON FUNCTION public.trg_referral_relations_insert_team_joined() IS

  'Stage 73.5: пишет teammate_joined в referral_team_events при новой связи (анти-дубль по паре referrer+referee+тип).';



-- Замена базового индекса Stage 73.3 на покрывающий (referrer_id, created_at DESC INCLUDE …).

DROP INDEX IF EXISTS public.idx_referral_team_events_referrer_created;

CREATE INDEX IF NOT EXISTS idx_referral_team_events_referrer_created_cover

  ON public.referral_team_events (referrer_id, created_at DESC)

  INCLUDE (event_type, referee_id);



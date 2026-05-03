-- =============================================================
-- MIGRATION v2: ajusta envios_whatsapp ao contrato definitivo
-- - status restrito a ('enviado','erro','pendente')
-- - remove policy de UPDATE para usuário comum
-- - REPLICA IDENTITY FULL para Realtime UPDATE com payload completo
-- - garante publicação supabase_realtime
-- Idempotente.
-- =============================================================

-- 1) Drop CHECK antigo (se existir) e migra dados legados
ALTER TABLE public.envios_whatsapp
  DROP CONSTRAINT IF EXISTS envios_whatsapp_status_check;

UPDATE public.envios_whatsapp
  SET status = 'erro'
  WHERE status NOT IN ('enviado', 'erro', 'pendente');

-- 2) CHECK novo, conforme spec
ALTER TABLE public.envios_whatsapp
  ADD CONSTRAINT envios_whatsapp_status_check
  CHECK (status IN ('enviado', 'erro', 'pendente'));

-- 3) Remove policy de UPDATE para usuário comum (apenas service role do n8n)
DROP POLICY IF EXISTS "envios_whatsapp_update_own" ON public.envios_whatsapp;

-- 4) Garante índice composto (user_id, created_at DESC) — os existentes
--    são separados; o composto acelera a query do EnvioTab.
CREATE INDEX IF NOT EXISTS envios_whatsapp_user_id_created_at_idx
  ON public.envios_whatsapp (user_id, created_at DESC);

-- 5) REPLICA IDENTITY FULL — necessário para receber payload completo em UPDATE
ALTER TABLE public.envios_whatsapp REPLICA IDENTITY FULL;

-- 6) Garante publicação Realtime (ignora erro se já estiver publicada)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.envios_whatsapp;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
  END;
END $$;

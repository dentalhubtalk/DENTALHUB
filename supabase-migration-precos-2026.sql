-- =============================================================
-- MIGRATION: Ajuste de pre\u00e7os dos planos (abr/2026)
-- Mensal R$37, Trimestral R$99, Semestral R$187, Anual R$357
-- =============================================================

UPDATE public.planos SET valor = 37.00,  descricao = 'Renova\u00e7\u00e3o a cada 30 dias',  ativo = true WHERE slug = 'mensal';
UPDATE public.planos SET valor = 99.00,  descricao = 'Equivale a R$ 33/m\u00eas \u2014 renova\u00e7\u00e3o a cada 90 dias', ativo = true WHERE slug = 'trimestral';
UPDATE public.planos SET valor = 187.00, descricao = 'Equivale a R$ 31/m\u00eas \u2014 renova\u00e7\u00e3o a cada 180 dias', ativo = true WHERE slug = 'semestral';
UPDATE public.planos SET valor = 357.00, descricao = 'Equivale a R$ 29/m\u00eas \u2014 melhor custo-benef\u00edcio', ativo = true WHERE slug = 'anual';

-- Garantia: se algum plano n\u00e3o existir, insere
INSERT INTO public.planos (slug, nome, valor, ciclo, descricao, ativo)
VALUES
  ('mensal',     'Plano Mensal',     37.00,  'mensal',     'Renova\u00e7\u00e3o a cada 30 dias', true),
  ('trimestral', 'Plano Trimestral', 99.00,  'trimestral', 'Equivale a R$ 33/m\u00eas \u2014 renova\u00e7\u00e3o a cada 90 dias', true),
  ('semestral',  'Plano Semestral',  187.00, 'semestral',  'Equivale a R$ 31/m\u00eas \u2014 renova\u00e7\u00e3o a cada 180 dias', true),
  ('anual',      'Plano Anual',      357.00, 'anual',      'Equivale a R$ 29/m\u00eas \u2014 melhor custo-benef\u00edcio', true)
ON CONFLICT (slug) DO NOTHING;

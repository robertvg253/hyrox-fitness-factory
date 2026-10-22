-- ==============================================================================
-- FASE H15: REFACTOR DE ARQUITECTURA (SIN EQUIPOS)
-- ==============================================================================
-- Se descarta el concepto de tabla equipos y equipo_id.
-- En participantes_simulacion solo se almacena categoria_id y partner_nombres (texto).
-- ==============================================================================

ALTER TABLE public.participantes_simulacion 
  ADD COLUMN IF NOT EXISTS partner_nombres TEXT;

-- Índices recomendados
CREATE INDEX IF NOT EXISTS idx_participantes_partner_nombres ON public.participantes_simulacion(partner_nombres);

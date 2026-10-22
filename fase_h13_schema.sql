-- ==============================================================================
-- FASE H13: LÓGICA RELACIONAL DE CATEGORÍAS, EQUIPOS Y PREINSCRIPCIONES
-- ==============================================================================
-- Este script asegura las columnas relacionales necesarias en Supabase para
-- soportar inscripciones individuales y por duplas agrupadas por equipo_id.
-- ==============================================================================

-- 1. Asegurar columnas categoria_id y equipo_id en public.participantes_simulacion
ALTER TABLE public.participantes_simulacion 
  ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES public.categorias(id);

ALTER TABLE public.participantes_simulacion 
  ADD COLUMN IF NOT EXISTS equipo_id UUID;

CREATE INDEX IF NOT EXISTS idx_participantes_categoria_id ON public.participantes_simulacion(categoria_id);
CREATE INDEX IF NOT EXISTS idx_participantes_equipo_id ON public.participantes_simulacion(equipo_id);

-- 2. Asegurar campos en public.preinscripciones
ALTER TABLE public.preinscripciones 
  ADD COLUMN IF NOT EXISTS telefono TEXT;

ALTER TABLE public.preinscripciones 
  ADD COLUMN IF NOT EXISTS genero TEXT;

ALTER TABLE public.preinscripciones 
  ADD COLUMN IF NOT EXISTS equipo_id UUID;

ALTER TABLE public.preinscripciones 
  ADD COLUMN IF NOT EXISTS simulacion_id UUID REFERENCES public.simulaciones(id);

CREATE INDEX IF NOT EXISTS idx_preinscripciones_email ON public.preinscripciones(email);
CREATE INDEX IF NOT EXISTS idx_preinscripciones_reclamado ON public.preinscripciones(reclamado);

-- 3. Asegurar campos opcionales en public.usuarios
ALTER TABLE public.usuarios 
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;

ALTER TABLE public.usuarios 
  ADD COLUMN IF NOT EXISTS genero TEXT;

-- 4. Habilitar RLS y políticas seguras
ALTER TABLE public.preinscripciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir gestión completa de preinscripciones a service_role" ON public.preinscripciones;
CREATE POLICY "Permitir gestión completa de preinscripciones a service_role"
  ON public.preinscripciones
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- FASE H17.4: POLÍTICAS RLS PARA LECTURA DE TIEMPOS HISTÓRICOS Y COMPETICIÓN
-- ==============================================================================
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.
-- Permite que los usuarios autenticados puedan leer sus propios tiempos
-- y los datos de su categoría/participación en la simulación.
-- ==============================================================================

-- 1. Políticas para public.tiempos_historicos
ALTER TABLE public.tiempos_historicos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver sus tiempos" ON public.tiempos_historicos;
CREATE POLICY "Usuarios pueden ver sus tiempos"
  ON public.tiempos_historicos
  FOR SELECT
  TO authenticated
  USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Service role acceso total tiempos_historicos" ON public.tiempos_historicos;
CREATE POLICY "Service role acceso total tiempos_historicos"
  ON public.tiempos_historicos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Políticas para public.participantes_simulacion
ALTER TABLE public.participantes_simulacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver su participacion" ON public.participantes_simulacion;
CREATE POLICY "Usuarios pueden ver su participacion"
  ON public.participantes_simulacion
  FOR SELECT
  TO authenticated
  USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Service role acceso total participantes_simulacion" ON public.participantes_simulacion;
CREATE POLICY "Service role acceso total participantes_simulacion"
  ON public.participantes_simulacion
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Políticas para public.categorias (permite join para usuarios autenticados)
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de categorias a autenticados" ON public.categorias;
CREATE POLICY "Permitir lectura de categorias a autenticados"
  ON public.categorias
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role acceso total categorias" ON public.categorias;
CREATE POLICY "Service role acceso total categorias"
  ON public.categorias
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
